import { dim, formatBytes } from "./colors.js";

const TERMINAL_RESET = "\x1b[0m\x1b[?25h\x1b[?2026l\x1b[?1049l\x1b[?1047l\x1b[?47l";

export interface RendererStats {
  elapsed_ms: number;
  bytes: number;
}

export class PtyRenderer {
  private color: (s: string) => string = (s) => s;
  private engineLabel = "";
  private role = "";
  private receivedBytes = 0;
  private started = false;
  private endedWithLineBreak = true;

  start(
    engineLabel: string,
    role: string,
    color: (s: string) => string,
  ): void {
    if (this.started) return;
    this.started = true;
    this.color = color;
    this.engineLabel = engineLabel;
    this.role = role;
    this.receivedBytes = 0;

    const header = this.color(
      `  \u250C\u2500 \u25A0 ${this.engineLabel} (${this.role}) ${"\u2500".repeat(Math.max(0, 44 - this.engineLabel.length - this.role.length - 3))}\u2510`,
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

  stop(stats: RendererStats): void {
    if (!this.started) return;
    this.started = false;

    // Restore common terminal modes in case the executor CLI was killed mid-TUI
    process.stdout.write(TERMINAL_RESET);
    if (!this.endedWithLineBreak) {
      process.stdout.write("\r\n");
    }

    const elapsed = formatElapsed(stats.elapsed_ms);
    const bytes = formatBytes(stats.bytes);
    console.log(this.color("  \u2502"));
    const statsText = `\u2713 done ${dim(`(${elapsed}, ${bytes})`)}`;
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

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const remainSec = Math.floor(sec % 60);
  return `${min}m${remainSec}s`;
}

export interface KeystrokeHandlerOpts {
  writeToPty: (data: string) => void;
  onDone: () => void;
  onCancel: () => void;
  onModeToggle: () => void;
}

/**
 * Forward user input to the PTY while reserving a small set of
 * loop control shortcuts.
 * Returns a cleanup function.
 */
export function startKeystrokeHandler(
  writeToPty: (data: string) => void,
  opts: {
    onDone: () => void;
    onCancel: () => void;
    onModeToggle: () => void;
  },
): () => void {
  const isTTY = !!process.stdin.isTTY;

  if (isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();

  let lastCtrlC = 0;

  function onData(data: Buffer): void {
    const str = typeof data === "string" ? data : data.toString("utf8");

    // Shift+Tab: toggle mode
    if (str === "\x1b[Z") {
      opts.onModeToggle();
      return;
    }

    // Ctrl+D: done
    if (str === "\x04") {
      opts.onDone();
      return;
    }

    // Ctrl+C: double-tap to cancel, single forwards to PTY
    if (str === "\x03") {
      const now = Date.now();
      if (now - lastCtrlC < 500) {
        opts.onCancel();
        return;
      }
      lastCtrlC = now;
      writeToPty(str);
      return;
    }

    writeToPty(str);
  }

  process.stdin.on("data", onData);

  return () => {
    process.stdin.removeListener("data", onData);
    if (isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
  };
}
