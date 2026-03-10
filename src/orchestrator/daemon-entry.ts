#!/usr/bin/env node

/**
 * Daemon entry point — spawned as a detached background process by
 * `loop daemon start`.  Creates an OrchestratorDaemon and starts it.
 * The IPC server keeps the process alive.
 */

import { OrchestratorDaemon } from "./daemon.js";

const projectRoot = process.cwd();
const daemon = new OrchestratorDaemon(projectRoot);

daemon.start().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`daemon-entry: failed to start: ${message}\n`);
  process.exit(1);
});
