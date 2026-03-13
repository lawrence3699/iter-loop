import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pty from "node-pty";
import { stripAnsi } from "../utils/ansi.js";

const DEFAULT_TIMEOUT_MS = 3_600_000;
const POLL_INTERVAL_MS = 100;
const PTY_PROBE_OUTPUT = "loop-pty-health";

export type RuntimeTransport = "pty" | "tty-capture" | "pipe" | "unsupported";
export type RuntimeProgressPhase =
  | "probe"
  | "transport"
  | "startup"
  | "status"
  | "stream"
  | "parsing"
  | "waiting"
  | "submit"
  | "review"
  | "complete";

export interface RuntimeProgressEvent {
  phase: RuntimeProgressPhase;
  summary: string;
  detail?: string;
  transport?: RuntimeTransport;
  elapsedMs?: number;
  bytes?: number;
}

export interface StructuredRunOptions {
  cwd?: string;
  verbose?: boolean;
  onData?: (chunk: string) => void;
  onStatus?: (status: string) => void;
  onProgress?: (event: RuntimeProgressEvent) => void;
  passthroughArgs?: string[];
  timeout?: number;
}

interface StructuredOutputParser {
  pushChunk(chunk: string, callbacks: StructuredRunOptions): void;
  finish(rawOutput: string, callbacks: StructuredRunOptions): string;
}

let cachedPtyHealth: boolean | null = null;

function emitProgress(
  callbacks: StructuredRunOptions,
  event: RuntimeProgressEvent,
): void {
  callbacks.onProgress?.(event);
}

class ClaudeStructuredParser implements StructuredOutputParser {
  private lineBuffer = "";
  private resultText = "";

  pushChunk(chunk: string, callbacks: StructuredRunOptions): void {
    this.lineBuffer += chunk;

    let newlineIndex = this.lineBuffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const rawLine = this.lineBuffer.slice(0, newlineIndex);
      this.lineBuffer = this.lineBuffer.slice(newlineIndex + 1);
      this.processLine(rawLine.trim(), callbacks);
      newlineIndex = this.lineBuffer.indexOf("\n");
    }
  }

  finish(rawOutput: string, callbacks: StructuredRunOptions): string {
    this.processLine(this.lineBuffer.trim(), callbacks);
    return this.resultText || stripAnsi(rawOutput).trim();
  }

  private processLine(line: string, callbacks: StructuredRunOptions): void {
    if (!line) return;

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }

    if (event.type === "system") {
      callbacks.onStatus?.("session started");
      emitProgress(callbacks, {
        phase: "status",
        summary: "Session started",
      });
      return;
    }

    if (event.type === "stream_event" && isRecord(event.event)) {
      const inner = event.event;
      if (
        inner.type === "content_block_start" &&
        isRecord(inner.content_block) &&
        typeof inner.content_block.name === "string"
      ) {
        callbacks.onStatus?.(inner.content_block.name);
        emitProgress(callbacks, {
          phase: "status",
          summary: inner.content_block.name,
        });
        return;
      }

      if (
        inner.type === "content_block_delta" &&
        isRecord(inner.delta) &&
        inner.delta.type === "text_delta" &&
        typeof inner.delta.text === "string"
      ) {
        callbacks.onData?.(inner.delta.text);
      }
      return;
    }

    if (event.type === "assistant" && isRecord(event.message) && Array.isArray(event.message.content)) {
      for (const block of event.message.content) {
        if (isRecord(block) && block.type === "tool_use" && typeof block.name === "string") {
          callbacks.onStatus?.(block.name);
          emitProgress(callbacks, {
            phase: "status",
            summary: block.name,
          });
        }
      }
      return;
    }

    if (event.type === "result" && typeof event.result === "string") {
      this.resultText = event.result;
    }
  }
}

class GeminiStructuredParser implements StructuredOutputParser {
  private lineBuffer = "";
  private deltaText = "";
  private assistantMessage = "";

  pushChunk(chunk: string, callbacks: StructuredRunOptions): void {
    this.lineBuffer += chunk;

    let newlineIndex = this.lineBuffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const rawLine = this.lineBuffer.slice(0, newlineIndex);
      this.lineBuffer = this.lineBuffer.slice(newlineIndex + 1);
      this.processLine(rawLine.trim(), callbacks);
      newlineIndex = this.lineBuffer.indexOf("\n");
    }
  }

  finish(rawOutput: string, callbacks: StructuredRunOptions): string {
    this.processLine(this.lineBuffer.trim(), callbacks);
    return this.deltaText || this.assistantMessage || stripAnsi(rawOutput).trim();
  }

  private processLine(line: string, callbacks: StructuredRunOptions): void {
    if (!line) return;

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }

    if (event.type === "init" && typeof event.model === "string") {
      callbacks.onStatus?.(event.model);
      emitProgress(callbacks, {
        phase: "status",
        summary: `Model: ${event.model}`,
      });
      return;
    }

    if (
      event.type === "message" &&
      event.role === "assistant" &&
      typeof event.content === "string"
    ) {
      if (event.delta === true) {
        this.deltaText += event.content;
        callbacks.onData?.(event.content);
      } else {
        this.assistantMessage = event.content;
      }
    }
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function createTempOutputPath(engineName: string): string {
  return join(
    tmpdir(),
    `loop-${engineName}-${process.pid}-${Date.now()}-${randomUUID()}.log`,
  );
}

function hasInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY || process.stdout.isTTY || process.stderr.isTTY);
}

async function readIncrementalChunk(
  filePath: string,
  cursor: { offset: number },
): Promise<string> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return "";
    }
    throw err;
  }

  if (content.length <= cursor.offset) {
    return "";
  }

  const chunk = content.slice(cursor.offset);
  cursor.offset = content.length;
  return chunk;
}

async function runStructuredTtyCapture(
  engineName: "claude" | "gemini",
  command: string,
  args: string[],
  opts: StructuredRunOptions,
  parser: StructuredOutputParser,
): Promise<string> {
  if (!hasInteractiveTerminal()) {
    emitProgress(opts, {
      phase: "transport",
      summary: "Interactive terminal unavailable",
      transport: "unsupported",
    });
    throw new Error(
      `${engineName} requires an interactive terminal in the current runtime. ` +
      "Pipe-based execution is disabled because it hangs on this machine.",
    );
  }

  const cwd = opts.cwd ?? process.cwd();
  const outputPath = createTempOutputPath(engineName);
  const timeoutMs = opts.timeout ?? DEFAULT_TIMEOUT_MS;
  const shellCommand = `${[command, ...args].map(shellQuote).join(" ")} > ${shellQuote(outputPath)} 2>&1`;
  const startedAt = Date.now();
  const proc = spawn("/bin/sh", ["-lc", shellCommand], {
    cwd,
    stdio: ["inherit", "inherit", "inherit"],
    env: { ...process.env, FORCE_COLOR: "0" },
  });

  return new Promise<string>((resolve, reject) => {
    let finished = false;
    let rawOutput = "";
    const cursor = { offset: 0 };
    let sawOutput = false;

    emitProgress(opts, {
      phase: "transport",
      summary: "Selected TTY capture transport",
      transport: "tty-capture",
      detail: command,
    });
    emitProgress(opts, {
      phase: "startup",
      summary: "Starting engine process",
      transport: "tty-capture",
    });

    const cleanup = async (): Promise<void> => {
      clearInterval(poller);
      clearTimeout(timer);
      try {
        await unlink(outputPath);
      } catch {
        // Ignore cleanup failure
      }
    };

    const flushOutput = async (): Promise<void> => {
      const chunk = await readIncrementalChunk(outputPath, cursor);
      if (!chunk) return;
      rawOutput += chunk;
      if (!sawOutput) {
        sawOutput = true;
        emitProgress(opts, {
          phase: "stream",
          summary: "Engine output detected",
          transport: "tty-capture",
        });
      }
      parser.pushChunk(chunk, opts);
    };

    const finishSuccess = async (): Promise<void> => {
      if (finished) return;
      finished = true;
      try {
        emitProgress(opts, {
          phase: "parsing",
          summary: "Parsing structured output",
          transport: "tty-capture",
        });
        await flushOutput();
        const output = parser.finish(rawOutput, opts);
        emitProgress(opts, {
          phase: "complete",
          summary: "Engine run complete",
          transport: "tty-capture",
          elapsedMs: Date.now() - startedAt,
          bytes: Buffer.byteLength(output),
        });
        await cleanup();
        resolve(output);
      } catch (err) {
        await cleanup();
        reject(err);
      }
    };

    const finishError = async (err: Error): Promise<void> => {
      if (finished) return;
      finished = true;
      try {
        await flushOutput();
      } catch {
        // Ignore readback errors in error path
      }
      await cleanup();
      reject(err);
    };

    const poller = setInterval(() => {
      void flushOutput().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        void finishError(new Error(`${engineName} output capture failed: ${message}`));
      });
    }, POLL_INTERVAL_MS);

    const timer = setTimeout(() => {
      try {
        proc.kill("SIGTERM");
      } catch {
        // Ignore timeout kill failures
      }
      void finishError(
        new Error(
          `${engineName} timed out (${Math.round(timeoutMs / 60_000)} minute limit)`,
        ),
      );
    }, timeoutMs);

    proc.on("close", (code) => {
      if (code !== 0) {
        const details = stripAnsi(rawOutput).trim();
        const suffix = details ? `\n${details}` : "";
        void finishError(new Error(`${engineName} exited with code ${code}${suffix}`));
      } else {
        void finishSuccess();
      }
    });

    proc.on("error", (err) => {
      const message = err instanceof Error ? err.message : String(err);
      void finishError(new Error(`${engineName} failed to start: ${message}`));
    });
  });
}

export function isPtyHealthy(): boolean {
  if (cachedPtyHealth !== null) {
    return cachedPtyHealth;
  }

  try {
    const proc = pty.spawn("/bin/echo", [PTY_PROBE_OUTPUT], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: { ...process.env },
    });
    try {
      proc.kill();
    } catch {
      // Ignore probe cleanup failures
    }
    cachedPtyHealth = true;
  } catch {
    cachedPtyHealth = false;
  }

  return cachedPtyHealth;
}

export function resetPtyHealthCacheForTest(): void {
  cachedPtyHealth = null;
}

export function parseClaudeStructuredOutput(
  rawOutput: string,
  callbacks: StructuredRunOptions = {},
): string {
  const parser = new ClaudeStructuredParser();
  parser.pushChunk(rawOutput, callbacks);
  return parser.finish(rawOutput, callbacks);
}

export function parseGeminiStructuredOutput(
  rawOutput: string,
  callbacks: StructuredRunOptions = {},
): string {
  const parser = new GeminiStructuredParser();
  parser.pushChunk(rawOutput, callbacks);
  return parser.finish(rawOutput, callbacks);
}

export function supportsTtyCapturedExecution(): boolean {
  return hasInteractiveTerminal();
}

export async function runClaudeTtyCapture(
  prompt: string,
  opts: StructuredRunOptions,
): Promise<string> {
  return runStructuredTtyCapture(
    "claude",
    "claude",
    [
      "-p",
      prompt,
      "--output-format",
      "stream-json",
      "--include-partial-messages",
      "--verbose",
      ...(opts.passthroughArgs ?? []),
    ],
    opts,
    new ClaudeStructuredParser(),
  );
}

export async function runGeminiTtyCapture(
  prompt: string,
  opts: StructuredRunOptions,
): Promise<string> {
  return runStructuredTtyCapture(
    "gemini",
    "gemini",
    [
      "-p",
      prompt,
      "--output-format",
      "stream-json",
      ...(opts.passthroughArgs ?? []),
    ],
    opts,
    new GeminiStructuredParser(),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
