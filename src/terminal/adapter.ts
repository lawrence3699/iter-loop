/**
 * Terminal adapter interface and factory.
 *
 * Each adapter wraps a specific terminal environment (Terminal.app, tmux,
 * iTerm2, internal PTY) behind a common interface so the agent launcher
 * can spawn and manage processes uniformly.
 *
 * Ported from ufoo's adapterRouter.js / adapterContract.js with simplified
 * TypeScript interfaces.
 */

import type { LaunchMode } from "./detect.js";

// ---------------------------------------------------------------------------
// Capability declaration
// ---------------------------------------------------------------------------

export interface TerminalCapabilities {
  /** Can bring the terminal window / pane to the foreground. */
  supportsActivate: boolean;
  /** Can inject text into a running process via send-keys or socket. */
  supportsInjection: boolean;
  /** Supports reusing a previous session in the same terminal / pane. */
  supportsSessionReuse: boolean;
  /** Can programmatically resize the PTY. */
  supportsResize: boolean;
}

// ---------------------------------------------------------------------------
// Launch / process interfaces
// ---------------------------------------------------------------------------

export interface AdapterLaunchOptions {
  cwd: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export interface LaunchedProcess {
  pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onData(handler: (data: string) => void): void;
  onExit(handler: (code: number) => void): void;
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

export interface TerminalAdapter {
  mode: LaunchMode;
  capabilities: TerminalCapabilities;

  /**
   * Spawn a new process inside this terminal environment.
   */
  launch(
    command: string,
    args: string[],
    opts: AdapterLaunchOptions,
  ): Promise<LaunchedProcess>;

  /**
   * Inject text into a running process (e.g. tmux send-keys).
   * Only available when `capabilities.supportsInjection` is true.
   */
  inject?(processOrId: number | string, command: string): Promise<void>;

  /**
   * Bring the terminal window / pane to the foreground.
   * Only available when `capabilities.supportsActivate` is true.
   */
  activate?(processOrId: number | string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the appropriate terminal adapter for the given launch mode.
 *
 * Adapters are lazily imported to avoid loading unnecessary platform-specific
 * code (e.g. osascript helpers on Linux).
 */
export async function createAdapter(mode: LaunchMode): Promise<TerminalAdapter> {
  switch (mode) {
    case "terminal": {
      const { NativeTerminalAdapter } = await import("./terminal-adapter.js");
      return new NativeTerminalAdapter();
    }
    case "tmux": {
      const { TmuxAdapter } = await import("./tmux-adapter.js");
      return new TmuxAdapter();
    }
    case "iterm2": {
      const { ITerm2Adapter } = await import("./iterm2-adapter.js");
      return new ITerm2Adapter();
    }
    case "pty":
    case "auto":
    default: {
      const { PtyAdapter } = await import("./pty-adapter.js");
      return new PtyAdapter();
    }
  }
}
