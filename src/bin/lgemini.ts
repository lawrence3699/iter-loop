#!/usr/bin/env node
import { launchWrappedAgent } from "../agent/wrapper.js";
launchWrappedAgent("gemini", process.argv.slice(2)).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
