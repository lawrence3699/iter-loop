export type EngineName = "claude" | "gemini" | "codex";
export type ExecutionMode = "auto" | "manual";
export type LaunchMode = "terminal" | "tmux" | "iterm2" | "pty" | "auto";

export interface LoopConfig {
  defaultExecutor: EngineName;
  defaultReviewer: EngineName;
  maxIterations: number;
  threshold: number;
  mode: ExecutionMode;
  launchMode: LaunchMode;
  autoResume: boolean;
  skillsDir?: string;
  verbose: boolean;
}

export const ENGINE_NAMES: readonly EngineName[] = ["claude", "gemini", "codex"] as const;

export const DEFAULT_CONFIG: LoopConfig = {
  defaultExecutor: "claude",
  defaultReviewer: "gemini",
  maxIterations: 3,
  threshold: 9,
  mode: "manual",
  launchMode: "auto",
  autoResume: false,
  verbose: false,
};

function isEngineName(value: unknown): value is EngineName {
  return typeof value === "string" && ENGINE_NAMES.includes(value as EngineName);
}

function isExecutionMode(value: unknown): value is ExecutionMode {
  return value === "auto" || value === "manual";
}

function isLaunchMode(value: unknown): value is LaunchMode {
  return (
    value === "terminal" ||
    value === "tmux" ||
    value === "iterm2" ||
    value === "pty" ||
    value === "auto"
  );
}

export function validateConfig(raw: unknown): LoopConfig {
  if (typeof raw !== "object" || raw === null) {
    return { ...DEFAULT_CONFIG };
  }

  const obj = raw as Record<string, unknown>;

  return {
    defaultExecutor: isEngineName(obj.defaultExecutor)
      ? obj.defaultExecutor
      : DEFAULT_CONFIG.defaultExecutor,
    defaultReviewer: isEngineName(obj.defaultReviewer)
      ? obj.defaultReviewer
      : DEFAULT_CONFIG.defaultReviewer,
    maxIterations:
      typeof obj.maxIterations === "number" &&
      obj.maxIterations >= 1 &&
      obj.maxIterations <= 20
        ? obj.maxIterations
        : DEFAULT_CONFIG.maxIterations,
    threshold:
      typeof obj.threshold === "number" &&
      obj.threshold >= 1 &&
      obj.threshold <= 10
        ? obj.threshold
        : DEFAULT_CONFIG.threshold,
    mode: isExecutionMode(obj.mode) ? obj.mode : DEFAULT_CONFIG.mode,
    launchMode: isLaunchMode(obj.launchMode)
      ? obj.launchMode
      : DEFAULT_CONFIG.launchMode,
    autoResume:
      typeof obj.autoResume === "boolean"
        ? obj.autoResume
        : DEFAULT_CONFIG.autoResume,
    skillsDir:
      typeof obj.skillsDir === "string" ? obj.skillsDir : undefined,
    verbose:
      typeof obj.verbose === "boolean" ? obj.verbose : DEFAULT_CONFIG.verbose,
  };
}
