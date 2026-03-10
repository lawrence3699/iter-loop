/**
 * ActivityDetector — monitors a PtySession to determine the agent's
 * current activity state.
 *
 * State machine:
 *
 *   starting ──▶ working ◀──▶ idle
 *                  │             ▲
 *                  ▼             │
 *            waiting_input ──────┘
 *                  │
 *                  ▼
 *               blocked
 *
 * Ported from ufoo's activityDetector.js, adapted to listen on
 * PtySession events rather than receiving raw processOutput calls.
 */

import type { PtySession } from "./pty-session.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActivityState =
  | "idle"
  | "working"
  | "starting"
  | "waiting_input"
  | "blocked";

type StateChangeListener = (newState: ActivityState, oldState: ActivityState) => void;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Time to wait after last output before classifying as idle / waiting_input. */
const DEFAULT_QUIET_WINDOW_MS = 5_000;

/** Time in waiting_input before escalating to blocked. */
const DEFAULT_BLOCKED_TIMEOUT_MS = 300_000; // 5 min

/** How many tail characters to check for input prompts. */
const TAIL_BUFFER_SIZE = 4_000;
const TAIL_LINES = 10;

/** ANSI / OSC stripping patterns (for the rolling buffer). */
const ANSI_RE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const OSC_RE = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;

// Agent-specific patterns that indicate the CLI is waiting for user input.
const INPUT_PATTERNS: Record<string, RegExp[]> = {
  "claude-code": [
    /\bAllow\b.*\bDeny\b/,
    /\ballow mcp\b/i,
    /Enter to select.*\u2191\/\u2193 to navigate/,
  ],
  codex: [
    /\[Y\/n\]/,
    /\by\/n\b/i,
  ],
};

const COMMON_INPUT_PATTERNS: RegExp[] = [
  /Continue\?\s*$/m,
  /Proceed\?\s*$/m,
  /Press enter/i,
  /\(y\/n\)\s*:?\s*$/m,
];

// Deny-list: per-line context that suppresses false positive prompt matches.
const LINE_DENY_PATTERNS: RegExp[] = [
  /function\s+\w+/,
  /\/\//,
  /import\s+/,
  /require\s*\(/,
];

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class ActivityDetector {
  private _state: ActivityState = "starting";
  private _since: number = Date.now();
  private _detail: string = "";
  private _buffer = "";

  private _listeners: StateChangeListener[] = [];
  private _blockedTimer: ReturnType<typeof setTimeout> | null = null;
  private _quietTimer: ReturnType<typeof setTimeout> | null = null;
  private _quietToken = 0;

  private readonly _quietWindowMs: number;
  private readonly _blockedTimeoutMs: number;
  private readonly _agentType: string;

  private readonly _onPtyData: (data: string) => void;
  private readonly _onIdle: () => void;
  private readonly _session: PtySession;

  constructor(ptySession: PtySession, agentType?: string, options?: {
    quietWindowMs?: number;
    blockedTimeoutMs?: number;
  }) {
    this._session = ptySession;
    this._agentType = agentType ?? "";
    this._quietWindowMs = options?.quietWindowMs ?? DEFAULT_QUIET_WINDOW_MS;
    this._blockedTimeoutMs = options?.blockedTimeoutMs ?? DEFAULT_BLOCKED_TIMEOUT_MS;

    // PTY data → mark working, buffer output, schedule classification
    this._onPtyData = (data: string) => {
      this._processOutput(data);
    };

    // Idle event → fast-path to idle state
    this._onIdle = () => {
      this._markIdle();
    };

    this._session.on("pty-data", this._onPtyData);
    this._session.on("idle", this._onIdle);
  }

  // ── Public API ──────────────────────────────────────────────────────────

  getState(): ActivityState {
    return this._state;
  }

  /** Timestamp of the last state transition. */
  get since(): number {
    return this._since;
  }

  /** Detail string associated with the current state. */
  get detail(): string {
    return this._detail;
  }

  onStateChange(listener: StateChangeListener): void {
    this._listeners.push(listener);
  }

  destroy(): void {
    this._clearBlockedTimer();
    this._clearQuietTimer();
    this._listeners = [];
    this._session.removeListener("pty-data", this._onPtyData);
    this._session.removeListener("idle", this._onIdle);
  }

  // ── Internal transitions ────────────────────────────────────────────────

  private _setState(newState: ActivityState, detail = ""): void {
    if (newState === this._state) return;
    const oldState = this._state;
    this._state = newState;
    this._since = Date.now();
    this._detail = detail;
    for (const cb of this._listeners) {
      try {
        cb(newState, oldState);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Process raw PTY output: normalize, buffer, transition to WORKING,
   * and schedule quiet-window classification.
   */
  private _processOutput(raw: string): void {
    const normalized = this._normalize(raw);
    if (!normalized) return;

    // Check for meaningful visible content
    const visible = normalized.replace(/[\s\u0000-\u001F\u007F]+/g, "");
    if (visible.length === 0) return;

    // STARTING → WORKING on first meaningful output
    if (this._state === "starting") {
      this._setState("working", "output");
    }

    // Append to rolling buffer
    this._buffer += normalized;
    if (this._buffer.length > TAIL_BUFFER_SIZE) {
      this._buffer = this._buffer.slice(-TAIL_BUFFER_SIZE);
    }

    // Any output means WORKING (cancels prior waiting/blocked)
    if (this._state !== "working") {
      this._clearBlockedTimer();
      this._setState("working");
    }

    this._scheduleQuietClassification();
  }

  private _markIdle(): void {
    if (
      this._state !== "working" &&
      this._state !== "waiting_input" &&
      this._state !== "blocked"
    ) {
      return;
    }
    this._clearBlockedTimer();
    this._clearQuietTimer();
    this._buffer = "";
    this._setState("idle");
  }

  // ── Quiet-window classification ─────────────────────────────────────────

  private _scheduleQuietClassification(): void {
    this._quietToken += 1;
    const token = this._quietToken;
    this._clearQuietTimer();
    this._quietTimer = setTimeout(() => {
      if (token !== this._quietToken) return;
      this._quietTimer = null;
      this._classifyAfterQuiet();
    }, this._quietWindowMs);
    if (this._quietTimer && typeof this._quietTimer.unref === "function") {
      this._quietTimer.unref();
    }
  }

  private _classifyAfterQuiet(): void {
    if (this._state !== "working") return;

    const tail = this._tailWindow();

    // Check agent-specific and common prompt patterns
    const agentPatterns = INPUT_PATTERNS[this._agentType] ?? [];
    const allPatterns = [...agentPatterns, ...COMMON_INPUT_PATTERNS];

    for (const pattern of allPatterns) {
      const match = pattern.exec(tail);
      if (!match) continue;

      const matchedText = match[0] ?? "";
      const matchIndex = Number.isFinite(match.index)
        ? match.index
        : Math.max(0, tail.length - matchedText.length);

      if (this._hasDeniedContext(tail, matchIndex, matchedText.length)) continue;

      this._setState("waiting_input", pattern.source);
      this._startBlockedTimer();
      return;
    }

    // No input patterns matched → idle
    this._setState("idle");
  }

  private _tailWindow(): string {
    if (!this._buffer) return "";
    const lines = this._buffer.split("\n");
    if (lines.length <= TAIL_LINES) return this._buffer;
    return lines.slice(-TAIL_LINES).join("\n");
  }

  private _hasDeniedContext(
    haystack: string,
    matchIndex: number,
    matchLength: number,
  ): boolean {
    // Inside a code fence?
    const before = haystack.slice(0, Math.max(0, matchIndex));
    const fences = before.match(/```/g);
    if ((fences ? fences.length : 0) % 2 === 1) return true;

    // Check surrounding line against deny patterns
    const center = Math.max(0, matchIndex + Math.max(0, Math.trunc(matchLength / 2)));
    const lineStart = haystack.lastIndexOf("\n", center - 1) + 1;
    const lineEndCandidate = haystack.indexOf("\n", center);
    const lineEnd = lineEndCandidate >= 0 ? lineEndCandidate : haystack.length;
    const line = haystack.slice(lineStart, lineEnd);

    return LINE_DENY_PATTERNS.some((deny) => deny.test(line));
  }

  // ── Timers ──────────────────────────────────────────────────────────────

  private _startBlockedTimer(): void {
    this._clearBlockedTimer();
    this._blockedTimer = setTimeout(() => {
      this._blockedTimer = null;
      if (this._state === "waiting_input") {
        this._setState(
          "blocked",
          `waiting_input for ${this._blockedTimeoutMs}ms`,
        );
      }
    }, this._blockedTimeoutMs);
    if (this._blockedTimer && typeof this._blockedTimer.unref === "function") {
      this._blockedTimer.unref();
    }
  }

  private _clearBlockedTimer(): void {
    if (this._blockedTimer) {
      clearTimeout(this._blockedTimer);
      this._blockedTimer = null;
    }
  }

  private _clearQuietTimer(): void {
    if (this._quietTimer) {
      clearTimeout(this._quietTimer);
      this._quietTimer = null;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private _normalize(text: string): string {
    if (!text) return "";
    return String(text)
      .replace(OSC_RE, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(ANSI_RE, "");
  }
}
