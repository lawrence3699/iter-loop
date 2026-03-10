/**
 * Internal PTY adapter (default fallback).
 *
 * Uses `node-pty` to spawn a pseudo-terminal without any visible terminal
 * window — fully headless.  This is the most commonly used adapter and serves
 * as the default when no specific terminal environment is detected.
 *
 * Ported from ufoo's adapters/internalPtyAdapter.js.
 */

import pty from "node-pty";
import type {
  AdapterLaunchOptions,
  LaunchedProcess,
  TerminalAdapter,
  TerminalCapabilities,
} from "./adapter.js";
import type { LaunchMode } from "./detect.js";

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class PtyAdapter implements TerminalAdapter {
  readonly mode: LaunchMode = "pty";

  readonly capabilities: TerminalCapabilities = {
    supportsActivate: false,
    supportsInjection: true,
    supportsSessionReuse: false,
    supportsResize: true,
  };

  async launch(
    command: string,
    args: string[],
    opts: AdapterLaunchOptions,
  ): Promise<LaunchedProcess> {
    const cols = opts.cols ?? process.stdout.columns ?? 80;
    const rows = opts.rows ?? process.stdout.rows ?? 24;

    const ptyProcess = pty.spawn(command, args, {
      name: "xterm-256color",
      cols,
      rows,
      cwd: opts.cwd,
      env: { ...process.env, ...(opts.env ?? {}) },
    });

    const dataHandlers: Array<(data: string) => void> = [];
    const exitHandlers: Array<(code: number) => void> = [];

    ptyProcess.onData((data: string) => {
      for (const h of dataHandlers) h(data);
    });

    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      for (const h of exitHandlers) h(exitCode);
    });

    return {
      pid: ptyProcess.pid,
      write(data: string) {
        try {
          ptyProcess.write(data);
        } catch {
          // Process may have exited
        }
      },
      resize(c: number, r: number) {
        try {
          ptyProcess.resize(c, r);
        } catch {
          // Process may have exited
        }
      },
      kill() {
        try {
          ptyProcess.kill();
        } catch {
          // Already dead
        }
      },
      onData(handler: (data: string) => void) {
        dataHandlers.push(handler);
      },
      onExit(handler: (code: number) => void) {
        exitHandlers.push(handler);
      },
    };
  }

  async inject(_processOrId: number | string, command: string): Promise<void> {
    // For the internal PTY, injection is just writing to the PTY stdin.
    // The caller must hold a reference to the LaunchedProcess to use write().
    // This method exists for symmetry but cannot reach an arbitrary process.
    void command;
    throw new Error("PtyAdapter.inject requires direct LaunchedProcess.write()");
  }
}
