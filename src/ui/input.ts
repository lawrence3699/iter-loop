import { dim, cyan, bold } from "./colors.js";

export type ExecutionMode = "auto" | "manual";

export interface PromptResult {
  value: string;
  action: "submit" | "done" | "cancel";
}

function modeIndicator(mode: ExecutionMode): string {
  const a = mode === "auto" ? bold("\u23F5\u23F5 Auto") : dim("\u23F5\u23F5 Auto");
  const m = mode === "manual" ? bold("\u23F5\u23F5 Manual") : dim("\u23F5\u23F5 Manual");
  return `  ${a}      ${m}                    ${dim("Shift+Tab \u21C4")}`;
}

export function promptUser(opts?: {
  hint?: string;
  mode?: string;
}): Promise<PromptResult> {
  const cols = process.stdout.columns || 80;
  let mode: ExecutionMode = (opts?.mode === "auto" ? "auto" : "manual");

  // Top bar
  const tag = opts?.hint ? ` ${opts.hint} ` : " \u25AA\u25AA\u25AA ";
  const barLen = Math.max(0, cols - tag.length - 4);
  const leftBar = "\u2500".repeat(Math.floor(barLen * 0.85));
  const rightBar = "\u2500".repeat(barLen - leftBar.length);
  process.stdout.write(dim(`  ${leftBar}${tag}${rightBar}`) + "\n");

  // Pre-print: input line (empty), bottom bar, mode indicator
  process.stdout.write("\n");
  process.stdout.write(dim(`  ${"\u2500".repeat(Math.max(0, cols - 4))}`) + "\n");
  process.stdout.write(modeIndicator(mode));

  // Move cursor up to input line, write prompt
  process.stdout.write("\x1b[2A\r");
  process.stdout.write(cyan("  \u276F "));

  // Raw-mode input loop
  let buffer = "";

  return new Promise<PromptResult>((resolve) => {
    const isTTY = !!process.stdin.isTTY;
    if (isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();

    function cleanup(): void {
      process.stdin.removeListener("data", onData);
      if (isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
    }

    function finish(action: PromptResult["action"]): void {
      // Move cursor past bottom bar + mode indicator, then newline
      process.stdout.write("\x1b[2B\n");
      cleanup();
      resolve({ value: buffer.trim(), action });
    }

    function onData(data: Buffer): void {
      const str = typeof data === "string" ? data : data.toString("utf8");

      // Shift+Tab: toggle mode
      if (str === "\x1b[Z") {
        mode = mode === "auto" ? "manual" : "auto";
        process.stdout.write("\x1b7");             // save cursor
        process.stdout.write("\x1b[2B\r\x1b[2K");  // down 2, beginning, clear line
        process.stdout.write(modeIndicator(mode));
        process.stdout.write("\x1b8");             // restore cursor
        return;
      }

      // Ctrl+C: cancel
      if (str === "\x03") {
        finish("cancel");
        return;
      }

      // Ctrl+D: done (exit multi-turn)
      if (str === "\x04") {
        finish("done");
        return;
      }

      // Enter: submit
      if (str === "\r" || str === "\n") {
        finish("submit");
        return;
      }

      // Backspace
      if (str === "\x7f" || str === "\x08") {
        if (buffer.length > 0) {
          const chars = [...buffer];
          const removed = chars.pop()!;
          buffer = chars.join("");
          // Move back by the display width of the removed character
          const width = removed.length > 1 || (removed.codePointAt(0) ?? 0) > 0xFFFF ? 2 : 1;
          for (let i = 0; i < width; i++) {
            process.stdout.write("\x1b[1D \x1b[1D");
          }
        }
        return;
      }

      // Ignore other escape sequences
      if (str.startsWith("\x1b")) return;

      // Printable characters (supports paste)
      for (const ch of str) {
        if (ch >= " ") {
          buffer += ch;
          process.stdout.write(ch);
        }
      }
    }

    process.stdin.on("data", onData);
  });
}
