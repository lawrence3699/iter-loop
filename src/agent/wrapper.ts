/**
 * Agent wrapper — entry point for lclaude / lgemini / lcodex binaries.
 *
 * Resolves the engine-specific CLI command, launches it through
 * AgentLauncher, and forwards stdin/stdout for interactive use.
 */

import { AgentLauncher } from "./launcher.js";

// ---------------------------------------------------------------------------
// Engine → command mapping
// ---------------------------------------------------------------------------

interface EngineSpec {
  command: string;
  defaultArgs: string[];
}

const ENGINES: Record<string, EngineSpec> = {
  claude: {
    command: "claude",
    defaultArgs: [],
  },
  gemini: {
    command: "gemini",
    defaultArgs: [],
  },
  codex: {
    command: "codex",
    defaultArgs: [],
  },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Launch a wrapped agent CLI.
 *
 * This function does not return until the agent exits (or is killed).
 * It sets up the full lifecycle: PtySession, detectors, signal handlers,
 * and interactive stdin/stdout forwarding.
 *
 * @param engineName - One of "claude", "gemini", "codex"
 * @param extraArgs  - Additional CLI arguments appended after defaults
 */
export async function launchWrappedAgent(
  engineName: string,
  extraArgs?: string[],
): Promise<void> {
  const spec = ENGINES[engineName];
  if (!spec) {
    console.error(`Unknown engine: ${engineName}`);
    console.error(`Supported engines: ${Object.keys(ENGINES).join(", ")}`);
    process.exit(1);
  }

  const args = [...spec.defaultArgs, ...(extraArgs ?? [])];
  const cwd = process.cwd();
  const launcher = new AgentLauncher(cwd);

  const agent = await launcher.launch({
    agentType: engineName,
    command: spec.command,
    args,
    cwd,
    nickname: process.env.LOOP_NICKNAME,
  });

  // Forward stdin to the PtySession
  if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  const onStdinData = (data: Buffer) => {
    const text = typeof data === "string" ? data : data.toString("utf8");
    agent.ptySession.write(text);
  };
  process.stdin.on("data", onStdinData);

  // Forward PTY output to stdout
  agent.ptySession.on("pty-data", (data: string) => {
    process.stdout.write(data);
  });

  // Handle terminal resize
  const onResize = () => {
    if (agent.ptySession.isAlive) {
      const cols = process.stdout.columns ?? 80;
      const rows = process.stdout.rows ?? 24;
      agent.ptySession.resize(cols, rows);
    }
  };
  if (process.stdout.isTTY) {
    process.stdout.on("resize", onResize);
  }

  // Wait for exit
  return new Promise<void>((resolve) => {
    agent.ptySession.on("exit", async (code: number) => {
      // Clean up stdin
      process.stdin.removeListener("data", onStdinData);
      if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
        try {
          process.stdin.setRawMode(false);
        } catch {
          // May fail if stream is already closed
        }
      }

      // Clean up resize handler
      if (process.stdout.isTTY) {
        process.stdout.removeListener("resize", onResize);
      }

      // Run cleanup (detectors, logger, sockets)
      await agent.cleanup();

      // Exit with the agent's code
      process.exitCode = code;
      resolve();
    });
  });
}
