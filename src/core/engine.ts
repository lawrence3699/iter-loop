/**
 * Engine abstraction — unified interface for Claude, Gemini, and Codex CLIs.
 *
 * Ported from iterloop's engine.ts with adaptations for loop-cli:
 * - Brand `color` property on each engine
 * - Timeout parameter on RunOptions
 * - ESM imports with .js extensions
 */

import { spawn, execFileSync } from "node:child_process";
import { stripAnsi } from "../utils/ansi.js";
import { createPtySession, type PtySession, type PtySessionOptions } from "../agent/pty-session.js";
import { claude as claudeColor, gemini as geminiColor, codex as codexColor } from "../ui/colors.js";

// Re-export PtySession types for consumer convenience
export type { PtySession, PtySessionOptions };

const DEFAULT_TIMEOUT = 3_600_000; // 1 hour

// ── Public types ─────────────────────────────────────

export type EngineName = "claude" | "gemini" | "codex";

export const ENGINE_NAMES: EngineName[] = ["claude", "gemini", "codex"];

export interface RunOptions {
  cwd?: string;
  verbose?: boolean;
  onData?: (chunk: string) => void;
  onStatus?: (status: string) => void;
  passthroughArgs?: string[];
  timeout?: number;
}

export interface InteractiveOptions {
  cwd?: string;
  args?: string[];
  cols?: number;
  rows?: number;
  env?: Record<string, string>;
  onData?: (data: string) => void;
  onExit?: (exitCode: number) => void;
  passthroughArgs?: string[];
}

export interface Engine {
  name: EngineName;
  label: string;
  color: (s: string) => string;
  checkVersion(): string;
  run(prompt: string, opts: RunOptions): Promise<string>;
  interactive(opts: InteractiveOptions): PtySession;
}

// ── Claude stream event types ────────────────────────

interface StreamSystemEvent {
  type: "system";
}

interface StreamEventWrapper {
  type: "stream_event";
  event?: {
    type: string;
    content_block?: { type: string; name?: string };
    delta?: { type: string; text?: string };
  };
}

interface StreamAssistantEvent {
  type: "assistant";
  message?: {
    content?: Array<{ type: string; name?: string; input?: Record<string, unknown> }>;
  };
}

interface StreamResultEvent {
  type: "result";
  result?: string;
}

type ClaudeStreamEvent =
  | StreamSystemEvent
  | StreamEventWrapper
  | StreamAssistantEvent
  | StreamResultEvent;

// ── Claude ───────────────────────────────────────────

function createClaude(): Engine {
  return {
    name: "claude",
    label: "Claude",
    color: claudeColor,

    checkVersion() {
      return execFileSync("claude", ["--version"], { encoding: "utf-8" }).trim();
    },

    run(prompt, opts) {
      // Use stream-json when streaming callbacks are provided (executor mode)
      if (opts.onData || opts.onStatus) {
        return spawnClaudeStream(prompt, opts);
      }
      return spawnEngine("claude", ["-p", prompt, ...(opts.passthroughArgs ?? [])], opts);
    },

    interactive(opts) {
      return createPtySession({
        cmd: "claude",
        args: [...(opts.passthroughArgs ?? [])],
        cwd: opts.cwd ?? process.cwd(),
        env: opts.env,
        engineName: "claude",
        onData: opts.onData,
        onExit: opts.onExit,
      });
    },
  };
}

// ── Gemini ───────────────────────────────────────────

function createGemini(): Engine {
  return {
    name: "gemini",
    label: "Gemini",
    color: geminiColor,

    checkVersion() {
      return execFileSync("gemini", ["--version"], { encoding: "utf-8" }).trim();
    },

    run(prompt, opts) {
      return spawnEngine("gemini", ["-p", prompt, ...(opts.passthroughArgs ?? [])], opts);
    },

    interactive(opts) {
      return createPtySession({
        cmd: "gemini",
        args: [...(opts.passthroughArgs ?? [])],
        cwd: opts.cwd ?? process.cwd(),
        env: opts.env,
        engineName: "gemini",
        onData: opts.onData,
        onExit: opts.onExit,
      });
    },
  };
}

// ── Codex ────────────────────────────────────────────

function createCodex(): Engine {
  return {
    name: "codex",
    label: "Codex",
    color: codexColor,

    checkVersion() {
      return execFileSync("codex", ["--version"], { encoding: "utf-8" }).trim();
    },

    run(prompt, opts) {
      const args = ["exec", "--full-auto", "--skip-git-repo-check"];
      if (opts.cwd) {
        args.push("-C", opts.cwd);
      }
      args.push(...(opts.passthroughArgs ?? []), prompt);
      return spawnEngine("codex", args, opts);
    },

    interactive(opts) {
      return createPtySession({
        cmd: "codex",
        args: [...(opts.passthroughArgs ?? [])],
        cwd: opts.cwd ?? process.cwd(),
        env: opts.env,
        engineName: "codex",
        onData: opts.onData,
        onExit: opts.onExit,
      });
    },
  };
}

// ── Factory ──────────────────────────────────────────

export function createEngine(name: EngineName): Engine {
  switch (name) {
    case "claude":
      return createClaude();
    case "gemini":
      return createGemini();
    case "codex":
      return createCodex();
  }
}

// ── Shared spawn helper ──────────────────────────────

function spawnEngine(
  cmd: string,
  args: string[],
  opts: RunOptions,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: opts.cwd ?? process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    let stdout = "";
    let stderr = "";

    const timeoutMs = opts.timeout ?? DEFAULT_TIMEOUT;
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`${cmd} timed out (${Math.round(timeoutMs / 60_000)} minute limit)`));
    }, timeoutMs);

    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      if (opts.onData) {
        opts.onData(text);
      } else if (opts.verbose) {
        process.stdout.write(text);
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      if (opts.verbose) {
        process.stderr.write(text);
      }
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`${cmd} exited with code ${code}\n${stderr}`));
      } else {
        resolve(stripAnsi(stdout).trim());
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ── Claude stream-json helpers ───────────────────────

function summarizeToolInput(name: string, input: Record<string, unknown>): string {
  if (input.file_path) return `${name} ${input.file_path}`;
  if (input.pattern) return `${name} ${input.pattern}`;
  if (input.command) {
    const cmd = String(input.command);
    return `${name} ${cmd.length > 60 ? cmd.slice(0, 57) + "..." : cmd}`;
  }
  if (input.query) return `${name} ${input.query}`;
  return name;
}

function spawnClaudeStream(
  prompt: string,
  opts: RunOptions,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      prompt,
      "--output-format",
      "stream-json",
      "--include-partial-messages",
      "--verbose",
      ...(opts.passthroughArgs ?? []),
    ];

    const proc = spawn("claude", args, {
      cwd: opts.cwd ?? process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    let resultText = "";
    let rawStdout = "";
    let stderr = "";
    let lineBuffer = "";

    const timeoutMs = opts.timeout ?? DEFAULT_TIMEOUT;
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`Claude CLI timed out (${Math.round(timeoutMs / 60_000)} minute limit)`));
    }, timeoutMs);

    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      rawStdout += text;
      lineBuffer += text;

      // Process complete JSON lines
      let nlIdx: number;
      while ((nlIdx = lineBuffer.indexOf("\n")) !== -1) {
        const line = lineBuffer.slice(0, nlIdx).trim();
        lineBuffer = lineBuffer.slice(nlIdx + 1);
        if (!line) continue;

        try {
          const event = JSON.parse(line) as ClaudeStreamEvent;
          handleStreamEvent(event, opts);
        } catch {
          // Non-JSON line — forward as plain text
          opts.onData?.(line + "\n");
        }
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      if (opts.verbose) {
        process.stderr.write(text);
      }
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Claude exited with code ${code}\n${stderr}`));
      } else {
        // Use parsed result if available, fall back to raw stdout
        resolve(resultText || stripAnsi(rawStdout).trim());
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    function handleStreamEvent(event: ClaudeStreamEvent, runOpts: RunOptions): void {
      switch (event.type) {
        case "system":
          runOpts.onStatus?.("session started");
          break;

        // Claude CLI wraps API streaming events inside {"type":"stream_event","event":{...}}
        case "stream_event": {
          const inner = event.event;
          if (!inner) break;

          if (inner.type === "content_block_start") {
            const block = inner.content_block;
            if (block?.type === "tool_use" && block.name) {
              runOpts.onStatus?.(block.name);
            } else if (block?.type === "thinking") {
              runOpts.onStatus?.("Thinking...");
            }
          } else if (inner.type === "content_block_delta") {
            const delta = inner.delta;
            if (delta?.type === "text_delta" && delta.text) {
              runOpts.onData?.(delta.text);
            }
            // thinking_delta — keep status as "Thinking..."
          }
          break;
        }

        case "assistant": {
          // Complete assistant message — extract tool use info for status
          const content = event.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "tool_use" && block.name) {
                runOpts.onStatus?.(summarizeToolInput(block.name, block.input ?? {}));
              }
            }
          }
          break;
        }

        case "result": {
          if (typeof event.result === "string") {
            resultText = event.result;
          }
          break;
        }
      }
    }
  });
}
