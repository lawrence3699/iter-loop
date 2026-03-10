/**
 * PTY output classification and filtering.
 *
 * Ported from iterloop's pty-session.ts — classifies raw terminal output lines
 * into content, status updates, or ignorable TUI noise so that only meaningful
 * text reaches the reviewer and transcript.
 */

// ── Types ────────────────────────────────────────────

export type LineClass = "content" | "status" | "ignore";

// ── Status keywords ──────────────────────────────────

const STATUS_KEYWORDS = [
  "harmonizing",
  "thinking",
  "planning",
  "generating",
  "searching",
  "analyzing",
  "burrowing",
  "contemplating",
  "flibbertigibbeting",
  "running stop hook",
];

// Note: ⏺ is NOT a spinner char — Claude CLI uses it as a content output marker
const SPINNER_CHARS = /^[\s✳✶✻✽✢·⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏●○◆◇▪▸▹►☐☑✓✗✔✘⏵]/;

// ── Line classifier ──────────────────────────────────

/**
 * Classify a single (ANSI-stripped) line of PTY output.
 *
 * - `"content"` — meaningful AI output to keep
 * - `"status"`  — transient status / spinner text
 * - `"ignore"`  — TUI chrome, empty lines, noise
 */
export function classifyLine(line: string, engine?: string): LineClass {
  const trimmed = line.trim();
  if (!trimmed) return "ignore";

  // Claude CLI content marker: ⏺ followed by text = actual AI output
  if (/^⏺/.test(trimmed)) {
    return trimmed.length > 1 ? "content" : "ignore";
  }

  // Short fragments (< 5 chars) from TUI cursor repositioning are artifacts
  if (trimmed.length < 5) return "ignore";

  // ── Known CLI UI elements to ignore ──

  // Prompt marker (with or without text)
  if (/^❯/.test(trimmed)) return "ignore";
  // Permission mode indicator
  if (/^⏵⏵/.test(trimmed)) return "ignore";
  // Update notices
  if (/update\s*avai|brew\s*upgrade/i.test(trimmed)) return "ignore";
  // Keyboard hints
  if (/shift\+tab/i.test(trimmed)) return "ignore";
  // Mode indicator
  if (/fast\s*mode/i.test(trimmed)) return "ignore";
  // Truncated UI text
  if (/^…\s/.test(trimmed) && trimmed.length < 80) return "ignore";

  // TUI box layout: lines inside boxes (start with │ or box corners)
  if (/^[│╭╰]/.test(trimmed)) return "ignore";

  // Status bar indicators (▪▪▪ pattern)
  if (/▪▪▪/.test(trimmed)) return "ignore";

  // Block element art (CLI logos, decorative)
  if (/^[\s▐▛▜▝▘█▌▪·↯]+$/.test(trimmed)) return "ignore";

  // Lines that are primarily horizontal rules/separators
  if (/^[─═\s▪·↯]+$/.test(trimmed)) return "ignore";

  // Box-drawing / UI chrome (pure box chars)
  if (/^[\s─│┌┐└┘├┤┬┴┼═╔╗╚╝╠╣╦╩╬┃┗┛┏┓╭╮╰╯▐▛▜▝]+$/.test(trimmed)) return "ignore";

  // Pure spinner characters
  if (/^[\s✳✶✻✽✢·⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]+$/.test(trimmed)) return "ignore";

  // ── Status detection ──

  const lower = trimmed.toLowerCase();
  for (const kw of STATUS_KEYWORDS) {
    if (lower.includes(kw)) return "status";
  }

  // Lines starting with spinner chars — only classify as status if it looks like
  // a real spinner update (very short text after the spinner prefix)
  if (SPINNER_CHARS.test(trimmed) && trimmed.length < 80) {
    const withoutPrefix = trimmed.replace(
      /^[\s✳✶✻✽✢·⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏●○◆◇▪▸▹►☐☑✓✗✔✘⏵]+\s*/,
      "",
    );
    if (withoutPrefix.length > 0 && withoutPrefix.length < 60) return "status";
    if (withoutPrefix.length === 0) return "ignore";
  }

  // For Claude engine: only ⏺-prefixed lines are true content.
  // Everything else that reaches here is TUI rendering noise.
  if (engine === "claude") return "ignore";

  return "content";
}

// ── Output filtering ─────────────────────────────────

/**
 * Filter raw PTY output to extract only meaningful content.
 *
 * Strips TUI chrome, spinners, box-drawing, update notices, and other noise.
 * For Claude output, strips the ⏺ content marker prefix.
 *
 * Result is capped at ~50 KB (last 50 KB on overflow).
 */
export function filterOutput(raw: string, _engine?: string): string {
  const lines = raw.split("\n");
  const filtered = lines
    .map((line) => {
      // Strip ⏺ content marker prefix from Claude CLI output
      const t = line.trim();
      if (t.startsWith("⏺")) return t.slice(1).trimStart();
      return line;
    })
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed === "") return true;

      // Short TUI fragments
      if (trimmed.length < 5) return false;
      if (/^[\s⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏●○◆◇✳✶✻✽✢·]+$/.test(trimmed)) return false;
      if (/^[\s─│┌┐└┘├┤┬┴┼═╔╗╚╝╠╣╦╩╬┃┗┛┏┓╭╮╰╯▐▛▜▝]+$/.test(trimmed)) return false;

      // Known UI noise
      if (/^❯/.test(trimmed)) return false;
      if (/^⏵⏵/.test(trimmed)) return false;
      if (/^[│╭╰]/.test(trimmed)) return false;
      if (/▪▪▪/.test(trimmed)) return false;
      if (/^[\s▐▛▜▝▘█▌▪·↯]+$/.test(trimmed)) return false;
      if (/^[─═\s▪·↯]+$/.test(trimmed)) return false;
      if (/update\s*avai|brew\s*upgrade/i.test(trimmed)) return false;
      if (/shift\+tab/i.test(trimmed)) return false;
      if (/fast\s*mode/i.test(trimmed)) return false;
      if (/^…\s/.test(trimmed) && trimmed.length < 80) return false;

      // Status lines
      const lower = trimmed.toLowerCase();
      if (STATUS_KEYWORDS.some((kw) => lower.includes(kw)) && trimmed.length < 80) return false;

      return true;
    });

  // Limit to last ~50 KB
  const MAX_BYTES = 50 * 1024;
  let result = filtered.join("\n");
  if (Buffer.byteLength(result) > MAX_BYTES) {
    const buf = Buffer.from(result);
    result = buf.subarray(buf.length - MAX_BYTES).toString("utf-8");
    const firstNewline = result.indexOf("\n");
    if (firstNewline > 0) {
      result = result.slice(firstNewline + 1);
    }
  }
  return result.trim();
}

// ── Deduplication ────────────────────────────────────

/**
 * Remove duplicate consecutive lines (TUI re-renders can emit the same
 * content multiple times).  Comparison ignores whitespace differences.
 */
export function deduplicateLines(lines: string[]): string[] {
  const result: string[] = [];
  let lastNorm = "";

  for (const line of lines) {
    const norm = line.replace(/\s+/g, "");
    if (norm !== lastNorm || norm === "") {
      result.push(line);
      lastNorm = norm;
    }
  }

  return result;
}
