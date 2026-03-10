import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SHARED_PLAN_FILENAME = ".loop-plan.md";

// ── Interfaces ──────────────────────────────────────

export interface SharedPlan {
  task: string;
  iterations: IterationRecord[];
  fileChangeLog: FileChange[];
}

export interface IterationRecord {
  iteration: number;
  executor: string;
  reviewer: string;
  score: number;
  approved: boolean;
  executorSummary: string;
  reviewerFeedback: string;
  timestamp: string;
}

export interface FileChange {
  iteration: number;
  file: string;
  action: "created" | "modified" | "deleted";
}

// ── Helpers ─────────────────────────────────────────

function getPlanPath(cwd: string): string {
  return join(cwd, SHARED_PLAN_FILENAME);
}

function readPlan(cwd: string): SharedPlan | null {
  const path = getPlanPath(cwd);
  if (!existsSync(path)) return null;
  try {
    const content = readFileSync(path, "utf-8");
    return parsePlan(content);
  } catch {
    return null;
  }
}

function writePlanSafe(cwd: string, content: string): void {
  try {
    writeFileSync(getPlanPath(cwd), content, "utf-8");
  } catch {
    // Fail-silent: never crash on write errors
  }
}

// ── Public API ──────────────────────────────────────

/** Initialize a new shared plan file. */
export async function initSharedPlan(cwd: string, task: string): Promise<void> {
  const content = renderPlan({
    task,
    iterations: [],
    fileChangeLog: [],
  });
  writePlanSafe(cwd, content);
}

/** Update the shared plan with a new iteration record. */
export async function updateSharedPlan(
  cwd: string,
  record: IterationRecord,
  filesChanged: string[],
): Promise<void> {
  const plan = readPlan(cwd) ?? {
    task: "",
    iterations: [],
    fileChangeLog: [],
  };

  plan.iterations.push(record);

  for (const file of filesChanged) {
    plan.fileChangeLog.push({
      iteration: record.iteration,
      file,
      action: "modified",
    });
  }

  writePlanSafe(cwd, renderPlan(plan));
}

/** Generate a context snippet from the shared plan for the executor prompt. */
export async function getExecutorContext(cwd: string): Promise<string> {
  const plan = readPlan(cwd);
  if (!plan || plan.iterations.length === 0) return "";

  const lastIter = plan.iterations[plan.iterations.length - 1];
  const lines: string[] = [
    "## Previous Iteration Context (from shared plan)",
    "",
    `Last iteration: ${lastIter.iteration}`,
    `Reviewer score: ${lastIter.score}/10`,
    `Approved: ${lastIter.approved ? "Yes" : "No"}`,
    "",
    "Recent feedback:",
    lastIter.reviewerFeedback,
  ];

  if (plan.fileChangeLog.length > 0) {
    lines.push("");
    lines.push("Files changed so far:");
    for (const change of plan.fileChangeLog) {
      lines.push(`- ${change.file} (${change.action}, iteration ${change.iteration})`);
    }
  }

  return lines.join("\n");
}

/** Generate a context snippet for the reviewer prompt. */
export async function getReviewerContext(cwd: string): Promise<string> {
  const plan = readPlan(cwd);
  if (!plan || plan.iterations.length === 0) return "";

  const lines: string[] = [
    "## Iteration History (from shared plan)",
    "",
  ];

  for (const iter of plan.iterations) {
    lines.push(
      `### Iteration ${iter.iteration}: Score ${iter.score}/10 (${iter.approved ? "Approved" : "Not approved"})`,
    );
    lines.push(`Key feedback: ${iter.reviewerFeedback.split("\n")[0]}`);
    lines.push("");
  }

  return lines.join("\n");
}

/** Clear the shared plan file. */
export async function clearPlan(cwd: string): Promise<void> {
  try {
    const path = getPlanPath(cwd);
    if (existsSync(path)) {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(path);
    }
  } catch {
    // Fail-silent
  }
}

/** Show the raw plan content. */
export async function showPlan(cwd: string): Promise<string> {
  const path = getPlanPath(cwd);
  if (!existsSync(path)) return "No plan file found.";
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "Error reading plan file.";
  }
}

// ── Rendering ───────────────────────────────────────

function renderPlan(plan: SharedPlan): string {
  const sections: string[] = [];

  sections.push("# Loop Shared Plan");
  sections.push("");
  sections.push("## Task");
  sections.push(plan.task);
  sections.push("");

  sections.push("## Iteration History");
  sections.push("");
  if (plan.iterations.length === 0) {
    sections.push("_No iterations yet._");
  } else {
    for (const iter of plan.iterations) {
      sections.push(`### Iteration ${iter.iteration}`);
      sections.push(`- **Timestamp:** ${iter.timestamp}`);
      sections.push(`- **Executor:** ${iter.executor}`);
      sections.push(`- **Reviewer:** ${iter.reviewer}`);
      sections.push(`- **Score:** ${iter.score}/10`);
      sections.push(`- **Approved:** ${iter.approved ? "Yes" : "No"}`);
      sections.push("");
      sections.push("**Executor Summary:**");
      sections.push(iter.executorSummary);
      sections.push("");
      sections.push("**Reviewer Feedback:**");
      sections.push(iter.reviewerFeedback);
      sections.push("");
    }
  }

  sections.push("## File Change Log");
  sections.push("");
  if (plan.fileChangeLog.length === 0) {
    sections.push("_No file changes recorded._");
  } else {
    for (const change of plan.fileChangeLog) {
      sections.push(`- [Iteration ${change.iteration}] ${change.action}: ${change.file}`);
    }
  }
  sections.push("");

  return sections.join("\n");
}

// ── Parsing ─────────────────────────────────────────

function parsePlan(content: string): SharedPlan {
  const plan: SharedPlan = {
    task: "",
    iterations: [],
    fileChangeLog: [],
  };

  // Extract task
  const taskMatch = content.match(/## Task\n([\s\S]*?)(?=\n## )/);
  if (taskMatch) plan.task = taskMatch[1].trim();

  // Extract iteration records
  const iterPattern = /### Iteration (\d+)\n([\s\S]*?)(?=\n### Iteration |\n## |$)/g;
  let iterMatch;
  while ((iterMatch = iterPattern.exec(content)) !== null) {
    const num = parseInt(iterMatch[1], 10);
    const body = iterMatch[2];

    const scoreMatch = body.match(/\*\*Score:\*\*\s*(\d+)/);
    const approvedMatch = body.match(/\*\*Approved:\*\*\s*(Yes|No)/i);
    const executorMatch = body.match(/\*\*Executor:\*\*\s*(\w+)/);
    const reviewerMatch = body.match(/\*\*Reviewer:\*\*\s*(\w+)/);
    const timestampMatch = body.match(/\*\*Timestamp:\*\*\s*(.+)/);
    const summaryMatch = body.match(
      /\*\*Executor Summary:\*\*\n([\s\S]*?)(?=\n\*\*Reviewer Feedback:\*\*|$)/,
    );
    const feedbackMatch = body.match(/\*\*Reviewer Feedback:\*\*\n([\s\S]*?)$/);

    plan.iterations.push({
      iteration: num,
      timestamp: timestampMatch?.[1]?.trim() ?? "",
      executor: executorMatch?.[1] ?? "",
      reviewer: reviewerMatch?.[1] ?? "",
      executorSummary: summaryMatch?.[1]?.trim() ?? "",
      score: scoreMatch ? parseInt(scoreMatch[1], 10) : 0,
      approved: approvedMatch?.[1]?.toLowerCase() === "yes",
      reviewerFeedback: feedbackMatch?.[1]?.trim() ?? "",
    });
  }

  // Extract file change log
  const changePattern = /- \[Iteration (\d+)\] (created|modified|deleted): (.+)/g;
  let changeMatch;
  while ((changeMatch = changePattern.exec(content)) !== null) {
    plan.fileChangeLog.push({
      iteration: parseInt(changeMatch[1], 10),
      file: changeMatch[3].trim(),
      action: changeMatch[2] as "created" | "modified" | "deleted",
    });
  }

  return plan;
}
