import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  type LoopConfig,
  type EngineName,
  type ExecutionMode,
  DEFAULT_CONFIG,
  validateConfig,
} from "./schema.js";

export { type LoopConfig, type EngineName, type ExecutionMode, DEFAULT_CONFIG, validateConfig } from "./schema.js";

function loadJsonSafe(filePath: string): Record<string, unknown> {
  try {
    const content = readFileSync(filePath, "utf-8");
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function applyEnvOverrides(config: LoopConfig): LoopConfig {
  const result = { ...config };

  const executor = process.env.LOOP_EXECUTOR;
  if (executor === "claude" || executor === "gemini" || executor === "codex") {
    result.defaultExecutor = executor as EngineName;
  }

  const reviewer = process.env.LOOP_REVIEWER;
  if (reviewer === "claude" || reviewer === "gemini" || reviewer === "codex") {
    result.defaultReviewer = reviewer as EngineName;
  }

  const iterations = process.env.LOOP_ITERATIONS;
  if (iterations) {
    const n = parseInt(iterations, 10);
    if (!isNaN(n) && n >= 1 && n <= 20) {
      result.maxIterations = n;
    }
  }

  const threshold = process.env.LOOP_THRESHOLD;
  if (threshold) {
    const n = parseInt(threshold, 10);
    if (!isNaN(n) && n >= 1 && n <= 10) {
      result.threshold = n;
    }
  }

  const mode = process.env.LOOP_MODE;
  if (mode === "auto" || mode === "manual") {
    result.mode = mode as ExecutionMode;
  }

  return result;
}

/**
 * Load configuration with cascade:
 * DEFAULT_CONFIG -> ~/.loop/config.json -> <cwd>/.loop/config.json -> env vars
 */
export async function loadConfig(cwd?: string): Promise<LoopConfig> {
  // Start with defaults
  let merged: Record<string, unknown> = { ...DEFAULT_CONFIG };

  // Layer 1: Global config (~/.loop/config.json)
  const globalPath = join(homedir(), ".loop", "config.json");
  const globalConfig = loadJsonSafe(globalPath);
  merged = { ...merged, ...globalConfig };

  // Layer 2: Project config (<cwd>/.loop/config.json)
  if (cwd) {
    const projectPath = join(cwd, ".loop", "config.json");
    const projectConfig = loadJsonSafe(projectPath);
    merged = { ...merged, ...projectConfig };
  }

  // Validate and normalize
  let config = validateConfig(merged);

  // Layer 3: Environment variable overrides
  config = applyEnvOverrides(config);

  return config;
}
