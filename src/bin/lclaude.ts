#!/usr/bin/env node
import { launchWrappedAgent } from "../agent/wrapper.js";
launchWrappedAgent("claude", process.argv.slice(2)).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
