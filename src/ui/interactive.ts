import * as p from "@clack/prompts";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { renderBanner } from "./banner.js";
import { type EngineName } from "../config/schema.js";
import { orange, gBlue, gGreen, bold, dim } from "./colors.js";

export interface InteractiveConfig {
  executor: string;
  reviewer: string;
  task: string;
  iterations: number;
  threshold: number;
  dir: string;
  verbose: boolean;
  mode: string;
  passthroughArgs: string[];
}

export async function interactive(): Promise<InteractiveConfig | null> {
  // Banner
  console.log(renderBanner());

  p.intro("Configure your loop session");

  // Working directory
  const dirChoice = await p.select({
    message: "Working directory",
    options: [
      {
        value: "cwd" as const,
        label: `Current directory (${process.cwd()})`,
        hint: "recommended",
      },
      { value: "custom" as const, label: "Custom path" },
    ],
  });
  if (p.isCancel(dirChoice)) {
    p.cancel("Cancelled.");
    return null;
  }

  let dir = ".";
  if (dirChoice === "custom") {
    while (true) {
      const dirInput = await p.text({
        message: "Enter path",
        placeholder: "/path/to/your/project",
      });
      if (p.isCancel(dirInput)) {
        p.cancel("Cancelled.");
        return null;
      }
      if (existsSync(resolve(dirInput))) {
        dir = dirInput;
        break;
      }
      p.log.error(
        `Directory not found: ${resolve(dirInput)}. Please try again.`,
      );
    }
  }

  // Executor
  const executor = await p.select({
    message: "Select executor",
    options: [
      {
        value: "claude" as const,
        label: orange("\u25CF") + " Claude",
        hint: "Anthropic Claude Code CLI",
      },
      {
        value: "gemini" as const,
        label: gBlue("\u25CF") + " Gemini",
        hint: "Google Gemini CLI",
      },
      {
        value: "codex" as const,
        label: gGreen("\u25CF") + " Codex",
        hint: "OpenAI Codex CLI",
      },
    ],
  });
  if (p.isCancel(executor)) {
    p.cancel("Cancelled.");
    return null;
  }

  // Reviewer
  const reviewer = await p.select({
    message: "Select reviewer",
    options: [
      {
        value: "claude" as const,
        label: orange("\u25CF") + " Claude",
        hint: "Anthropic Claude Code CLI",
      },
      {
        value: "gemini" as const,
        label: gBlue("\u25CF") + " Gemini",
        hint: "Google Gemini CLI",
      },
      {
        value: "codex" as const,
        label: gGreen("\u25CF") + " Codex",
        hint: "OpenAI Codex CLI",
      },
    ],
    initialValue: (executor === "claude" ? "gemini" : "claude") as EngineName,
  });
  if (p.isCancel(reviewer)) {
    p.cancel("Cancelled.");
    return null;
  }

  // Native CLI flags (optional)
  const passArgsInput = await p.text({
    message: "Native CLI flags for executor (optional)",
    placeholder: "e.g., --model claude-sonnet-4-20250514",
    defaultValue: "",
  });
  if (p.isCancel(passArgsInput)) {
    p.cancel("Cancelled.");
    return null;
  }
  const passthroughArgs = passArgsInput.trim()
    ? passArgsInput.split(/\s+/).filter(Boolean)
    : [];

  // Task
  const task = await p.text({
    message: "Enter your task",
    placeholder: "e.g. Write a quicksort implementation in Python",
    validate(value) {
      if (!value.trim()) return "Task cannot be empty";
    },
  });
  if (p.isCancel(task)) {
    p.cancel("Cancelled.");
    return null;
  }

  // Execution mode
  const mode = await p.select({
    message: "Execution mode",
    options: [
      {
        value: "manual" as const,
        label: bold("\u23F5\u23F5 Manual"),
        hint: "review each step, multi-turn conversation",
      },
      {
        value: "auto" as const,
        label: bold("\u23F5\u23F5 Auto"),
        hint: "fully automatic executor \u2192 reviewer",
      },
    ],
  });
  if (p.isCancel(mode)) {
    p.cancel("Cancelled.");
    return null;
  }

  // Iterations
  const iterations = await p.text({
    message: "Max iterations",
    placeholder: "3",
    defaultValue: "3",
    validate(value) {
      const n = parseInt(value, 10);
      if (isNaN(n) || n < 1 || n > 20) return "Enter a number between 1 and 20";
    },
  });
  if (p.isCancel(iterations)) {
    p.cancel("Cancelled.");
    return null;
  }

  // Threshold
  const threshold = await p.text({
    message: "Approval threshold (1-10)",
    placeholder: "9",
    defaultValue: "9",
    validate(value) {
      const n = parseInt(value, 10);
      if (isNaN(n) || n < 1 || n > 10) return "Enter a number between 1 and 10";
    },
  });
  if (p.isCancel(threshold)) {
    p.cancel("Cancelled.");
    return null;
  }

  // Verbose
  const verbose = await p.confirm({
    message: "Stream verbose output?",
    initialValue: false,
  });
  if (p.isCancel(verbose)) {
    p.cancel("Cancelled.");
    return null;
  }

  // Summary
  const resolvedDir = resolve(dir || ".");

  const engineLabel = (name: string): string => {
    switch (name) {
      case "claude":
        return orange("\u25CF") + " Claude";
      case "gemini":
        return gBlue("\u25CF") + " Gemini";
      case "codex":
        return gGreen("\u25CF") + " Codex";
      default:
        return name;
    }
  };

  const modeLabel =
    mode === "auto" ? bold("\u23F5\u23F5 Auto") : bold("\u23F5\u23F5 Manual");

  const summary = [
    `  Executor:    ${engineLabel(executor)}`,
    `  Reviewer:    ${engineLabel(reviewer)}`,
    "",
    `  Task:        ${task.length > 40 ? task.slice(0, 40) + "..." : task}`,
    `  Iterations:  ${iterations}`,
    `  Threshold:   ${threshold}`,
    `  Directory:   ${resolvedDir}`,
    `  Verbose:     ${verbose ? "on" : "off"}`,
    `  Mode:        ${modeLabel}`,
    `  CLI flags:   ${passthroughArgs.length > 0 ? passthroughArgs.join(" ") : dim("none")}`,
  ].join("\n");

  p.note(summary, "Configuration");

  // Confirm
  const confirmed = await p.confirm({
    message: "Launch?",
    initialValue: true,
  });
  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel("Cancelled.");
    return null;
  }

  p.outro("Launching loop...");

  return {
    executor,
    reviewer,
    task,
    iterations: parseInt(iterations, 10),
    threshold: parseInt(threshold, 10),
    dir: resolvedDir,
    verbose,
    mode,
    passthroughArgs,
  };
}
