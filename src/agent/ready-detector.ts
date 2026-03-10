/**
 * ReadyDetector — detects when an agent CLI has finished initializing
 * and is ready to accept input.
 *
 * Listens to PtySession "idle" events.  The first idle event after
 * construction is interpreted as "the agent prompt is visible".
 *
 * Also supports a force-ready fallback so callers can guarantee
 * the ready callback fires even if prompt detection fails.
 *
 * Ported from ufoo's readyDetector.js, adapted to the PtySession
 * EventEmitter interface.
 */

import type { PtySession } from "./pty-session.js";

export class ReadyDetector {
  private _ready = false;
  private _callbacks: Array<() => void> = [];
  private readonly _createdAt = Date.now();
  private _readyAt: number | null = null;
  private readonly _onIdle: () => void;
  private readonly _session: PtySession;

  constructor(ptySession: PtySession) {
    this._session = ptySession;
    this._onIdle = () => {
      this._triggerReady();
    };
    // Listen to the first "idle" event
    this._session.on("idle", this._onIdle);
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Register a callback that fires once when the agent is ready.
   * If already ready, the callback is invoked synchronously.
   */
  onReady(callback: () => void): void {
    if (this._ready) {
      callback();
    } else {
      this._callbacks.push(callback);
    }
  }

  /**
   * Force the detector into the ready state.
   * Useful as a timeout-based fallback.
   */
  forceReady(): void {
    this._triggerReady();
  }

  /** Whether the ready event has already fired. */
  get isReady(): boolean {
    return this._ready;
  }

  /**
   * Time in milliseconds from construction to ready detection.
   * Returns `null` if not yet ready.
   */
  get detectionTimeMs(): number | null {
    return this._readyAt !== null ? this._readyAt - this._createdAt : null;
  }

  /**
   * Tear down the detector and remove the PtySession listener.
   */
  destroy(): void {
    this._session.removeListener("idle", this._onIdle);
    this._callbacks = [];
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private _triggerReady(): void {
    if (this._ready) return;
    this._ready = true;
    this._readyAt = Date.now();

    // Remove the listener — we only need the first idle event
    this._session.removeListener("idle", this._onIdle);

    for (const cb of this._callbacks) {
      try {
        cb();
      } catch {
        // Ignore callback errors
      }
    }
    this._callbacks = [];
  }
}
