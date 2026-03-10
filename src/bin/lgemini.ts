#!/usr/bin/env node
import { launchWrappedAgent } from "../agent/wrapper.js";
launchWrappedAgent("gemini", process.argv.slice(2));
