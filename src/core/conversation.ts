/**
 * Multi-turn conversation session with an AI engine.
 *
 * Ported from iterloop's conversation.ts. Runs an interactive PTY session
 * with idle detection, mode toggling, and user-controlled continuation.
 */

import type { Engine } from "./engine.js";
import type { PtySession } from "../agent/pty-session.js";
import { dim, formatBytes, brandColor } from "../ui/colors.js";

// ── Public types ─────────────────────────────────────

export type ExecutionMode = "auto" | "manual";

export interface ConversationOptions {
  engine: Engine;
  initialPrompt: string;
  cwd: string;
  verbose: boolean;
  mode: { current: ExecutionMode };
  passthroughArgs?: string[];
}

export interface ConversationResult {
  finalOutput: string;
  duration_ms: number;
  bytes_received: number;
}

// ── Idle detection constants ─────────────────────────

/** Time to wait after detecting idle prompt before auto-proceeding (ms) */
const IDLE_DEBOUNCE_MS = 2000;

/** Silence timeout: no output for this long = likely idle (ms) */
const SILENCE_TIMEOUT_AUTO_MS = 30_000; // auto mode: 30s (executor may run long ops)
const SILENCE_TIMEOUT_MANUAL_MS = 5_000; // manual mode: 5s

/** Global PTY session timeout (ms) — prevents hanging forever */
const PTY_GLOBAL_TIMEOUT_MS = 3_600_000; // 1 hour

const TERMINAL_RESET = "\x1b[0m\x1b[?25h\x1b[?2026l\x1b[?1049l\x1b[?1047l\x1b[?47l";

// ── Renderer (inline, minimal) ───────────────────────

class PtyRenderer {
  private readonly color: (s: string) => string;
  private readonly engineLabel: string;
  private receivedBytes = 0;
  private started = false;
  private endedWithLineBreak = true;

  constructor(engineName: string, engineLabel: string) {
    this.color = brandColor(engineName);
    this.engineLabel = engineLabel;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    const header = this.color(
      `  \u250C\u2500 \u25A0 ${this.engineLabel} (executor) ${"\u2500".repeat(Math.max(0, 44 - this.engineLabel.length))}\u2510`,
    );
    console.log(header);
    console.log(this.color("  \u2502"));
    this.endedWithLineBreak = true;
  }

  write(data: string): void {
    if (!this.started) return;
    this.receivedBytes += Buffer.byteLength(data);
    process.stdout.write(data);
    this.endedWithLineBreak = /(?:\r\n|\r|\n)$/.test(data);
  }

  stop(stats: { elapsed: string; bytes: string }): void {
    if (!this.started) return;
    this.started = false;
    // Restore common terminal modes in case the CLI was killed mid-TUI
    process.stdout.write(TERMINAL_RESET);
    if (!this.endedWithLineBreak) {
      process.stdout.write("\r\n");
    }
    console.log(this.color("  \u2502"));
    const statsText = `\u2713 done ${dim(`(${stats.elapsed}, ${stats.bytes})`)}`;
    const footer =
      this.color(`  \u2514${"\u2500".repeat(42)}`) +
      ` ${statsText} ` +
      this.color("\u2500\u2518");
    console.log(footer);
  }

  get totalBytes(): number {
    return this.receivedBytes;
  }
}

// ── Keystroke handler ────────────────────────────────

interface KeystrokeHandlerOptions {
  session: PtySession;
  mode: { current: ExecutionMode };
  onDone: () => void;
  onCancel: () => void;
}

function startKeystrokeHandler(opts: KeystrokeHandlerOptions): () => void {
  const { session, mode, onDone, onCancel } = opts;
  const isTTY = !!process.stdin.isTTY;

  if (isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();

  let lastCtrlC = 0;

  function onData(data: Buffer): void {
    if (!session.isAlive) return;
    const str = typeof data === "string" ? data : data.toString("utf8");

    // Shift+Tab → toggle mode
    if (str === "\x1b[Z") {
      mode.current = mode.current === "auto" ? "manual" : "auto";
      return;
    }

    // Ctrl+D → done
    if (str === "\x04") {
      onDone();
      return;
    }

    // Ctrl+C → double-press = cancel, single = forward
    if (str === "\x03") {
      const now = Date.now();
      if (now - lastCtrlC < 500) {
        onCancel();
        return;
      }
      lastCtrlC = now;
      session.write(str);
      return;
    }

    session.write(str);
  }

  process.stdin.on("data", onData);

  return () => {
    process.stdin.removeListener("data", onData);
    if (isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
  };
}

// ── PTY-based interactive session ────────────────────

async function runPtySession(
  engine: Engine,
  initialPrompt: string,
  opts: {
    cwd: string;
    verbose: boolean;
    mode: { current: ExecutionMode };
    passthroughArgs?: string[];
  },
): Promise<{ output: string; bytes: number; durationMs: number }> {
  const globalStart = Date.now();

  // Set up renderer before spawning the PTY so the first frame is not missed
  const renderer = new PtyRenderer(engine.name, engine.label);
  renderer.start();

  // Create PTY session via engine.interactive()
  const session = engine.interactive({
    cwd: opts.cwd,
    passthroughArgs: opts.passthroughArgs,
    onData(data: string) {
      renderer.write(data);
    },
  });

  return new Promise((resolve, reject) => {
    let done = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let globalTimer: ReturnType<typeof setTimeout> | null = null;
    let promptSent = false;

    function stopRenderer(): void {
      const elapsed = `${((Date.now() - globalStart) / 1000).toFixed(1)}s`;
      renderer.stop({ elapsed, bytes: formatBytes(renderer.totalBytes) });
    }

    function finish(): void {
      if (done) return;
      done = true;

      // Clean up timers
      if (idleTimer) clearTimeout(idleTimer);
      if (silenceTimer) clearTimeout(silenceTimer);
      if (globalTimer) clearTimeout(globalTimer);

      // Stop keystroke forwarding
      cleanupKeystrokes();

      // Kill session if still alive
      session.kill();

      // Stop renderer (prints footer)
      stopRenderer();

      // Capture clean output for reviewer
      const output = session.getCleanOutput();
      const durationMs = Date.now() - globalStart;

      resolve({ output, bytes: renderer.totalBytes, durationMs });
    }

    function cancel(message = "Cancelled by user"): void {
      if (done) return;
      done = true;
      if (idleTimer) clearTimeout(idleTimer);
      if (silenceTimer) clearTimeout(silenceTimer);
      if (globalTimer) clearTimeout(globalTimer);
      cleanupKeystrokes();
      session.kill();
      stopRenderer();
      reject(new Error(message));
    }

    // Global timeout — prevent PTY session from hanging forever
    globalTimer = setTimeout(() => {
      if (!done) {
        cancel("PTY session timed out (1 hour limit)");
      }
    }, PTY_GLOBAL_TIMEOUT_MS);

    // Start keystroke forwarding (raw mode -> PTY)
    const cleanupKeystrokes = startKeystrokeHandler({
      session,
      mode: opts.mode,
      onDone: finish,
      onCancel: cancel,
    });

    // ── Idle detection ──

    function resetSilenceTimer(): void {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (done) return;
      const silenceTimeoutMs =
        opts.mode.current === "auto"
          ? SILENCE_TIMEOUT_AUTO_MS
          : SILENCE_TIMEOUT_MANUAL_MS;
      silenceTimer = setTimeout(() => {
        if (done || !promptSent) return;
        // Silence = CLI likely idle, proceed for both modes
        finish();
      }, silenceTimeoutMs);
    }

    // On PTY idle event (prompt detected)
    session.on("idle", () => {
      if (done) return;

      if (!promptSent) {
        // First idle = CLI is ready for input, send the task
        promptSent = true;
        session.sendLine(initialPrompt);
        resetSilenceTimer();
        return;
      }

      // Subsequent idle = CLI finished responding
      // Both modes: finish PTY session with debounce
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!done) finish();
      }, IDLE_DEBOUNCE_MS);
    });

    // Reset silence timer on each output chunk
    session.on("pty-data", () => {
      resetSilenceTimer();
      // Cancel idle debounce if more output arrives
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    });

    // Handle PTY process exit
    session.on("exit", () => {
      if (!done) {
        // Small delay to collect any final output
        setTimeout(() => finish(), 200);
      }
    });

    // Fallback: if no idle event fires within 10s, send prompt anyway
    setTimeout(() => {
      if (!promptSent && !done) {
        promptSent = true;
        session.sendLine(initialPrompt);
        resetSilenceTimer();
      }
    }, 10_000);

    // Handle terminal resize
    const onResize = (): void => {
      if (!done && session.isAlive) {
        const cols = process.stdout.columns || 80;
        const rows = process.stdout.rows || 24;
        session.resize(cols, rows);
      }
    };
    process.stdout.on("resize", onResize);

    // Clean up resize handler on session exit
    session.on("exit", () => {
      process.stdout.removeListener("resize", onResize);
    });
  });
}

// ── Main conversation loop ───────────────────────────

/**
 * Run a multi-turn conversation with an AI engine.
 *
 * In **auto** mode the PTY session runs to completion (idle detection / silence
 * timeout) and returns immediately.
 *
 * In **manual** mode the user is prompted after each turn to continue, switch
 * modes, or submit for review.
 */
export async function runConversation(
  opts: ConversationOptions,
): Promise<ConversationResult> {
  const { engine, initialPrompt, cwd, verbose, mode, passthroughArgs } = opts;

  if (mode.current === "manual") {
    console.log(dim("  Ctrl+D to submit for review, double Ctrl+C to abort\n"));
  }

  // Run first interactive PTY session
  const { output, bytes, durationMs } = await runPtySession(
    engine,
    initialPrompt,
    { cwd, verbose, mode, passthroughArgs },
  );

  // Auto mode: done, submit to reviewer
  if (mode.current === "auto") {
    return {
      finalOutput: output,
      duration_ms: durationMs,
      bytes_received: bytes,
    };
  }

  // Manual mode: the user can continue interacting or submit
  // For now, return the first session output. Full multi-turn manual flow
  // (promptUser loop) is handled at a higher layer.
  return {
    finalOutput: output,
    duration_ms: durationMs,
    bytes_received: bytes,
  };
}
