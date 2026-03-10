#!/usr/bin/env node
import { launchWrappedAgent } from "../agent/wrapper.js";
launchWrappedAgent("claude", process.argv.slice(2));
