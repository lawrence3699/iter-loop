/**
 * Structured communication protocol for loop iterations.
 *
 * Ported from iterloop's protocol.ts with the protocol name changed
 * from "iterloop-v1" to "loop-v1".
 */

import type { EngineName } from "./engine.js";

// ── Message type ─────────────────────────────────────

export interface LoopMessage {
  protocol: "loop-v1";
  timestamp: string;
  iteration: number;
  role: "executor" | "reviewer";
  engine: EngineName;
  task: {
    original: string;
    context: string;
  };
  output: {
    text: string;
    files_changed: string[];
    commands_executed: string[];
    status: "completed" | "needs_revision" | "error";
  };
  review?: {
    score: number;
    issues: string[];
    suggestions: string[];
    approved: boolean;
  };
  metadata: {
    duration_ms: number;
    bytes_received: number;
    model?: string;
  };
}

// ── Message constructors ─────────────────────────────

/** Create an executor message from session output. */
export function createExecutorMessage(params: {
  iteration: number;
  engine: EngineName;
  originalTask: string;
  context: string;
  outputText: string;
  durationMs: number;
  bytesReceived: number;
}): LoopMessage {
  return {
    protocol: "loop-v1",
    timestamp: new Date().toISOString(),
    iteration: params.iteration,
    role: "executor",
    engine: params.engine,
    task: {
      original: params.originalTask,
      context: params.context,
    },
    output: {
      text: params.outputText,
      files_changed: extractFilesChanged(params.outputText),
      commands_executed: extractCommandsExecuted(params.outputText),
      status: "completed",
    },
    metadata: {
      duration_ms: params.durationMs,
      bytes_received: params.bytesReceived,
    },
  };
}

/** Parse reviewer output into a structured review. */
export function parseReviewerOutput(
  reviewText: string,
  params: {
    iteration: number;
    engine: EngineName;
    originalTask: string;
    durationMs: number;
    bytesReceived: number;
  },
): LoopMessage {
  const score = extractScore(reviewText);
  const issues = extractListSection(reviewText, "issues");
  const suggestions = extractListSection(reviewText, "suggestions");
  const approved = reviewText
    .split("\n")
    .some((line) => /^\s*APPROVED\s*$/.test(line));

  return {
    protocol: "loop-v1",
    timestamp: new Date().toISOString(),
    iteration: params.iteration,
    role: "reviewer",
    engine: params.engine,
    task: {
      original: params.originalTask,
      context: "",
    },
    output: {
      text: reviewText,
      files_changed: [],
      commands_executed: [],
      status: approved ? "completed" : "needs_revision",
    },
    review: {
      score,
      issues,
      suggestions,
      approved,
    },
    metadata: {
      duration_ms: params.durationMs,
      bytes_received: params.bytesReceived,
    },
  };
}

/** Serialize a message to JSON string. */
export function serializeMessage(msg: LoopMessage): string {
  return JSON.stringify(msg, null, 2);
}

/** Deserialize a JSON string to a message. */
export function deserializeMessage(json: string): LoopMessage {
  const parsed: unknown = JSON.parse(json);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("protocol" in parsed) ||
    (parsed as Record<string, unknown>).protocol !== "loop-v1"
  ) {
    throw new Error(
      `Unknown protocol: ${typeof parsed === "object" && parsed !== null && "protocol" in parsed ? (parsed as Record<string, unknown>).protocol : "undefined"}`,
    );
  }
  return parsed as LoopMessage;
}

/** Format an executor message for inclusion in the reviewer prompt. */
export function formatForReviewer(msg: LoopMessage): string {
  const sections: string[] = [];

  sections.push(
    `## Executor Output (${msg.engine}, iteration ${msg.iteration})`,
  );
  sections.push("");
  sections.push(msg.output.text);

  if (msg.output.files_changed.length > 0) {
    sections.push("");
    sections.push("## Files Changed");
    for (const f of msg.output.files_changed) {
      sections.push(`- ${f}`);
    }
  }

  if (msg.output.commands_executed.length > 0) {
    sections.push("");
    sections.push("## Commands Executed");
    for (const c of msg.output.commands_executed) {
      sections.push(`- ${c}`);
    }
  }

  sections.push("");
  sections.push("## Metadata");
  sections.push(
    `- Duration: ${(msg.metadata.duration_ms / 1000).toFixed(1)}s`,
  );
  sections.push(`- Data received: ${msg.metadata.bytes_received} bytes`);

  return sections.join("\n");
}

// ── Extraction helpers ───────────────────────────────

function extractFilesChanged(text: string): string[] {
  const files: string[] = [];
  const patterns = [
    /(?:created|modified|wrote to|editing|writing)\s+(?:file:?\s*)?([^\s,]+\.\w+)/gi,
    /(?:Read|Edit|Write)\s+([^\s]+\.\w+)/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const file = match[1];
      if (!files.includes(file)) files.push(file);
    }
  }
  return files;
}

function extractCommandsExecuted(text: string): string[] {
  const commands: string[] = [];
  const patterns = [
    /^\$\s+(.+)$/gm,
    /(?:running|executing|ran):\s*(.+)$/gim,
    /Bash\s+(.+)$/gm,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const cmd = match[1].trim();
      if (cmd && !commands.includes(cmd)) commands.push(cmd);
    }
  }
  return commands;
}

function extractScore(text: string): number {
  const match =
    text.match(/(?:score|rating)\s*:?\s*(\d+)\s*(?:\/\s*10)?/i) ??
    text.match(/(\d+)\s*\/\s*10/);
  return match ? Math.min(10, Math.max(1, parseInt(match[1], 10))) : 0;
}

function extractListSection(text: string, sectionName: string): string[] {
  const items: string[] = [];
  const sectionPattern = new RegExp(
    `(?:#{1,3}\\s*)?${sectionName}[:\\s]*\\n([\\s\\S]*?)(?=\\n#{1,3}\\s|\\n\\n|$)`,
    "i",
  );
  const match = text.match(sectionPattern);
  if (match) {
    const lines = match[1].split("\n");
    for (const line of lines) {
      const itemMatch = line.match(/^\s*[-*\d.]+\s+(.+)/);
      if (itemMatch) items.push(itemMatch[1].trim());
    }
  }
  return items;
}
