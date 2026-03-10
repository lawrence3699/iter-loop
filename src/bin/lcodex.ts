#!/usr/bin/env node
import { launchWrappedAgent } from "../agent/wrapper.js";
launchWrappedAgent("codex", process.argv.slice(2));
