/**
 * Brand colors and ANSI formatting helpers.
 *
 * Uses raw ANSI escape codes for zero external dependencies.
 */

const ESC = "\x1b[";
const RESET = `${ESC}0m`;

// ── Brand colors (24-bit / true-color) ───────────────

/** Claude brand orange (#F07623) */
export const claude = (s: string): string => `${ESC}38;2;240;118;35m${s}${RESET}`;

/** Gemini brand blue (#4285F4) */
export const gemini = (s: string): string => `${ESC}38;2;66;133;244m${s}${RESET}`;

/** Codex brand green (#10A37F) */
export const codex = (s: string): string => `${ESC}38;2;16;163;127m${s}${RESET}`;

/** Loop brand cyan (#00D4FF) */
export const loop = (s: string): string => `${ESC}38;2;0;212;255m${s}${RESET}`;

// ── Semantic colors ──────────────────────────────────

/** Green for success messages */
export const success = (s: string): string => `${ESC}32m${s}${RESET}`;

/** Red for error messages */
export const error = (s: string): string => `${ESC}31m${s}${RESET}`;

/** Yellow for warnings */
export const warn = (s: string): string => `${ESC}33m${s}${RESET}`;

/** Gray / dim text */
export const dim = (s: string): string => `${ESC}2m${s}${RESET}`;

/** Bold text */
export const bold = (s: string): string => `${ESC}1m${s}${RESET}`;

// ── Aliases for convenience ─────────────────────────

export const orange = claude;
export const gBlue = gemini;
export const gGreen = codex;

export const red = error;
export const green = success;
export const yellow = warn;
export const cyan = loop;
export const blue = (s: string): string => `${ESC}34m${s}${RESET}`;

// ── Lookup helper ────────────────────────────────────

/**
 * Return the brand-color function for an engine name.
 * Falls back to `loop` cyan for unknown engines.
 */
export function brandColor(engine: string): (s: string) => string {
  switch (engine) {
    case "claude":
      return claude;
    case "gemini":
      return gemini;
    case "codex":
      return codex;
    default:
      return loop;
  }
}

/**
 * Format a byte count for human-readable display.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)}KB`;
  return `${(kb / 1024).toFixed(1)}MB`;
}
