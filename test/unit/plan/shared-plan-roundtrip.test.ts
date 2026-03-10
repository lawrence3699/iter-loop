import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  initSharedPlan,
  updateSharedPlan,
  getExecutorContext,
  getReviewerContext,
  type IterationRecord,
} from "../../../src/plan/shared-plan.js";

describe("shared-plan round-trip", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "loop-plan-roundtrip-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── initSharedPlan creates a valid plan ──────────────
  it("initSharedPlan creates a valid plan file with expected sections", async () => {
    await initSharedPlan(tmpDir, "Implement feature X");

    const content = readFileSync(join(tmpDir, ".loop-plan.md"), "utf-8");
    expect(content).toContain("# Loop Shared Plan");
    expect(content).toContain("## Task");
    expect(content).toContain("Implement feature X");
    expect(content).toContain("## Iteration History");
    expect(content).toContain("## File Change Log");
    expect(content).toContain("_No iterations yet._");
    expect(content).toContain("_No file changes recorded._");
  });

  // ── updateSharedPlan persists IterationRecord fields ─
  it("updateSharedPlan with score/approved fields persists correctly", async () => {
    await initSharedPlan(tmpDir, "Build API");

    const record: IterationRecord = {
      iteration: 1,
      executor: "claude",
      reviewer: "gemini",
      score: 7,
      approved: false,
      executorSummary: "Implemented endpoints",
      reviewerFeedback: "Missing validation logic",
      timestamp: "2025-06-15T12:00:00Z",
    };

    await updateSharedPlan(tmpDir, record, ["src/api.ts", "src/routes.ts"]);

    const content = readFileSync(join(tmpDir, ".loop-plan.md"), "utf-8");
    expect(content).toContain("**Score:** 7/10");
    expect(content).toContain("**Approved:** No");
    expect(content).toContain("**Executor:** claude");
    expect(content).toContain("**Reviewer:** gemini");
    expect(content).toContain("Implemented endpoints");
    expect(content).toContain("Missing validation logic");
    expect(content).toContain("src/api.ts");
    expect(content).toContain("src/routes.ts");
  });

  // ── getExecutorContext returns string containing score ─
  it("getExecutorContext returns string containing the score", async () => {
    await initSharedPlan(tmpDir, "Refactor module");

    await updateSharedPlan(
      tmpDir,
      {
        iteration: 1,
        executor: "claude",
        reviewer: "gemini",
        score: 5,
        approved: false,
        executorSummary: "First attempt",
        reviewerFeedback: "Needs better error handling",
        timestamp: "2025-06-15T12:00:00Z",
      },
      ["src/module.ts"],
    );

    const ctx = await getExecutorContext(tmpDir);
    expect(ctx).toContain("5/10");
    expect(ctx).toContain("Approved: No");
    expect(ctx).toContain("Needs better error handling");
    expect(ctx).toContain("src/module.ts");
  });

  // ── getReviewerContext returns iteration history ──────
  it("getReviewerContext returns string containing iteration history", async () => {
    await initSharedPlan(tmpDir, "Write tests");

    await updateSharedPlan(
      tmpDir,
      {
        iteration: 1,
        executor: "gemini",
        reviewer: "claude",
        score: 6,
        approved: false,
        executorSummary: "Added unit tests",
        reviewerFeedback: "Missing edge cases",
        timestamp: "2025-06-15T12:00:00Z",
      },
      [],
    );

    await updateSharedPlan(
      tmpDir,
      {
        iteration: 2,
        executor: "gemini",
        reviewer: "claude",
        score: 9,
        approved: true,
        executorSummary: "Added edge case tests",
        reviewerFeedback: "Comprehensive coverage now",
        timestamp: "2025-06-15T12:30:00Z",
      },
      ["test/utils.test.ts"],
    );

    const ctx = await getReviewerContext(tmpDir);
    expect(ctx).toContain("## Iteration History");
    expect(ctx).toContain("Score 6/10");
    expect(ctx).toContain("Not approved");
    expect(ctx).toContain("Score 9/10");
    expect(ctx).toContain("Approved");
    expect(ctx).toContain("Missing edge cases");
    expect(ctx).toContain("Comprehensive coverage now");
  });

  // ── Full round-trip: init → update → read back ───────
  it("round-trip: init → update → read back → verify fields match", async () => {
    const task = "Optimize database queries";
    await initSharedPlan(tmpDir, task);

    const record1: IterationRecord = {
      iteration: 1,
      executor: "claude",
      reviewer: "codex",
      score: 4,
      approved: false,
      executorSummary: "Added query caching",
      reviewerFeedback: "N+1 queries still present in user listing",
      timestamp: "2025-07-01T10:00:00Z",
    };

    const record2: IterationRecord = {
      iteration: 2,
      executor: "claude",
      reviewer: "codex",
      score: 9,
      approved: true,
      executorSummary: "Resolved N+1 with eager loading",
      reviewerFeedback: "All queries optimized, approved",
      timestamp: "2025-07-01T10:15:00Z",
    };

    await updateSharedPlan(tmpDir, record1, ["src/db.ts"]);
    await updateSharedPlan(tmpDir, record2, ["src/db.ts", "src/queries.ts"]);

    // Verify executor context reflects the LAST iteration
    const execCtx = await getExecutorContext(tmpDir);
    expect(execCtx).toContain("Last iteration: 2");
    expect(execCtx).toContain("9/10");
    expect(execCtx).toContain("Approved: Yes");
    expect(execCtx).toContain("All queries optimized, approved");

    // Verify reviewer context includes BOTH iterations
    const revCtx = await getReviewerContext(tmpDir);
    expect(revCtx).toContain("Iteration 1");
    expect(revCtx).toContain("Score 4/10");
    expect(revCtx).toContain("Iteration 2");
    expect(revCtx).toContain("Score 9/10");

    // Verify the raw plan file contains all file changes
    const raw = readFileSync(join(tmpDir, ".loop-plan.md"), "utf-8");
    expect(raw).toContain("src/db.ts");
    expect(raw).toContain("src/queries.ts");
    expect(raw).toContain(task);
  });
});
