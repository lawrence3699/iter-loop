/**
 * Terminal environment detection.
 *
 * Identifies the terminal emulator (iTerm2, tmux, Terminal.app, etc.)
 * and resolves a launch mode for agent spawning.
 *
 * Ported from ufoo's terminal/detect.js and launcher.js `resolveLaunchMode`.
 */

import { spawnSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LaunchMode = "terminal" | "tmux" | "iterm2" | "pty" | "auto";

// ---------------------------------------------------------------------------
// Terminal detection
// ---------------------------------------------------------------------------

/**
 * Detect the appropriate launch mode based on environment variables.
 *
 * Priority:
 *  1. LOOP_LAUNCH_MODE env override (explicit user choice)
 *  2. TMUX_PANE present → "tmux"
 *  3. ITERM_SESSION_ID present → "iterm2"
 *  4. Fallback → "pty" (headless internal PTY)
 */
export function detectTerminal(): LaunchMode {
  const explicit = (process.env.LOOP_LAUNCH_MODE ?? "").trim().toLowerCase();
  if (explicit === "terminal" || explicit === "tmux" || explicit === "iterm2" || explicit === "pty") {
    return explicit;
  }

  if (process.env.TMUX_PANE) return "tmux";
  if (process.env.ITERM_SESSION_ID) return "iterm2";

  return "pty";
}

// ---------------------------------------------------------------------------
// TTY detection
// ---------------------------------------------------------------------------

function normalizeTty(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "not a tty" || trimmed === "/dev/tty") {
    return undefined;
  }
  return trimmed;
}

/**
 * Detect the TTY device path for the current process.
 * Returns `undefined` when running without a controlling terminal.
 */
export function detectTTY(): string | undefined {
  // Allow explicit override for test / sandbox environments
  const override = normalizeTty(process.env.LOOP_TTY_OVERRIDE ?? "");
  if (override) return override;

  try {
    const result = spawnSync("tty", {
      stdio: [0, "pipe", "ignore"],
      encoding: "utf8",
    });
    if (result.status === 0 && result.stdout) {
      return normalizeTty(result.stdout);
    }
  } catch {
    // tty command unavailable or failed — not fatal
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// tmux pane detection
// ---------------------------------------------------------------------------

/**
 * Return the current tmux pane identifier (e.g. `%0`, `%1`).
 * Returns `undefined` when not inside a tmux session.
 */
export function detectTmuxPane(): string | undefined {
  const pane = process.env.TMUX_PANE;
  return pane ? pane.trim() || undefined : undefined;
}
