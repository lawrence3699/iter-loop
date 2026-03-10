import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression tests for the shared plan integration in loop.ts.
 *
 * Verifies:
 * 1. The SharedPlanModule interface uses async signatures (Promise return types)
 * 2. All plan function calls are awaited
 * 3. The record passed to updateSharedPlan uses `score` and `approved`
 *    (not the old `reviewerScore` / `reviewerApproved` field names)
 * 4. The IterationRecord type is imported from shared-plan.ts (not redefined locally)
 */

// Read the source file once for structural assertions
const loopSource = readFileSync(
  join(__dirname, "../../../src/core/loop.ts"),
  "utf-8",
);

describe("loop.ts shared plan integration", () => {
  // ── Structural / contract tests ────────────────────

  describe("async contract (SharedPlanModule interface)", () => {
    it("declares initSharedPlan as returning Promise<void>", () => {
      expect(loopSource).toMatch(
        /initSharedPlan:\s*\([^)]*\)\s*=>\s*Promise<void>/,
      );
    });

    it("declares updateSharedPlan as returning Promise<void>", () => {
      expect(loopSource).toMatch(
        /updateSharedPlan:\s*\([^)]*\)\s*=>\s*Promise<void>/,
      );
    });

    it("declares getExecutorContext as returning Promise<string>", () => {
      expect(loopSource).toMatch(
        /getExecutorContext:\s*\([^)]*\)\s*=>\s*Promise<string>/,
      );
    });

    it("declares getReviewerContext as returning Promise<string>", () => {
      expect(loopSource).toMatch(
        /getReviewerContext:\s*\([^)]*\)\s*=>\s*Promise<string>/,
      );
    });
  });

  describe("await usage on plan function calls", () => {
    it("awaits plan.initSharedPlan", () => {
      expect(loopSource).toMatch(/await\s+plan\.initSharedPlan\(/);
    });

    it("awaits plan.getExecutorContext", () => {
      expect(loopSource).toMatch(/await\s+plan\.getExecutorContext\(/);
    });

    it("awaits plan.getReviewerContext", () => {
      expect(loopSource).toMatch(/await\s+plan\.getReviewerContext\(/);
    });

    it("awaits plan.updateSharedPlan", () => {
      expect(loopSource).toMatch(/await\s+plan\.updateSharedPlan\(/);
    });

    it("does not call plan functions without await", () => {
      // Find all plan.* calls that are NOT preceded by await
      // First, check there are no non-awaited calls in the runLoop body
      const lines = loopSource.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip interface/type declarations and NO_OP_PLAN
        if (
          trimmed.startsWith("//") ||
          trimmed.startsWith("*") ||
          trimmed.startsWith("initSharedPlan") ||
          trimmed.startsWith("updateSharedPlan") ||
          trimmed.startsWith("getExecutorContext") ||
          trimmed.startsWith("getReviewerContext")
        ) {
          continue;
        }
        // If the line calls plan.XXX it must be preceded by await
        if (/plan\.(initSharedPlan|updateSharedPlan|getExecutorContext|getReviewerContext)\(/.test(trimmed)) {
          expect(trimmed).toMatch(/await\s+plan\./);
        }
      }
    });
  });

  describe("field name correctness (IterationRecord alignment)", () => {
    it("uses score (not reviewerScore) in updateSharedPlan call", () => {
      // The updateSharedPlan call site should contain 'score:' but NOT 'reviewerScore:'
      // Extract the updateSharedPlan call block
      const updateCallMatch = loopSource.match(
        /plan\.updateSharedPlan\(\s*\n?([\s\S]*?)\);/,
      );
      expect(updateCallMatch).not.toBeNull();
      const callBody = updateCallMatch![1];

      expect(callBody).toContain("score:");
      expect(callBody).not.toContain("reviewerScore:");
    });

    it("uses approved (not reviewerApproved) in updateSharedPlan call", () => {
      const updateCallMatch = loopSource.match(
        /plan\.updateSharedPlan\(\s*\n?([\s\S]*?)\);/,
      );
      expect(updateCallMatch).not.toBeNull();
      const callBody = updateCallMatch![1];

      expect(callBody).toContain("approved:");
      expect(callBody).not.toContain("reviewerApproved:");
    });

    it("does not define a local SharedPlanRecord interface", () => {
      expect(loopSource).not.toMatch(/interface\s+SharedPlanRecord\s*\{/);
    });

    it("imports IterationRecord from shared-plan", () => {
      expect(loopSource).toMatch(
        /import\s+.*IterationRecord.*from\s+["']\.\.\/plan\/shared-plan\.js["']/,
      );
    });
  });

  describe("NO_OP_PLAN uses async functions", () => {
    it("initSharedPlan no-op is async", () => {
      expect(loopSource).toMatch(/initSharedPlan:\s*async\s/);
    });

    it("updateSharedPlan no-op is async", () => {
      expect(loopSource).toMatch(/updateSharedPlan:\s*async\s/);
    });

    it("getExecutorContext no-op is async", () => {
      expect(loopSource).toMatch(/getExecutorContext:\s*async\s/);
    });

    it("getReviewerContext no-op is async", () => {
      expect(loopSource).toMatch(/getReviewerContext:\s*async\s/);
    });
  });

  // ── Integration test: updateSharedPlan record shape ──

  describe("IterationRecord field compatibility", () => {
    it("updateSharedPlan call includes all required IterationRecord fields", () => {
      // Extract the object literal passed to updateSharedPlan
      const updateCallMatch = loopSource.match(
        /plan\.updateSharedPlan\(\s*\n?\s*cwd,\s*\n?\s*\{([\s\S]*?)\},\s*\n?\s*executorMsg/,
      );
      expect(updateCallMatch).not.toBeNull();
      const objectBody = updateCallMatch![1];

      // All fields required by IterationRecord in shared-plan.ts
      const requiredFields = [
        "iteration",
        "timestamp",
        "executor",
        "reviewer",
        "executorSummary",
        "score",
        "approved",
        "reviewerFeedback",
      ];

      for (const field of requiredFields) {
        expect(objectBody).toContain(`${field}:`);
      }
    });
  });
});
