/**
 * Scoring and approval logic — extracted from the inline check in iterloop's
 * loop.ts into a reusable module.
 */

// ── Types ────────────────────────────────────────────

export interface ScoringConfig {
  /** Minimum score (1-10) required for automatic approval. Default: 9 */
  threshold: number;
  /** If true, only approve when the reviewer explicitly outputs APPROVED. Default: false */
  requireExplicitApproval: boolean;
}

export interface ScoringResult {
  /** The numeric score extracted from the review (0 if not found). */
  score: number;
  /** Whether the review meets approval criteria. */
  approved: boolean;
  /** Human-readable reason for the decision. */
  reason: string;
}

// ── Default config ───────────────────────────────────

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  threshold: 9,
  requireExplicitApproval: false,
};

// ── Evaluation ───────────────────────────────────────

/**
 * Evaluate a parsed review against the scoring configuration.
 *
 * Rules:
 * 1. If `review` is undefined → not approved, reason "No review data".
 * 2. If `requireExplicitApproval` is true → only approve when `review.approved === true`.
 * 3. Otherwise → approve when `review.score >= threshold` OR `review.approved === true`.
 */
export function evaluateReview(
  review:
    | {
        score: number;
        issues: string[];
        suggestions: string[];
        approved: boolean;
      }
    | undefined,
  config: ScoringConfig,
): ScoringResult {
  if (!review) {
    return {
      score: 0,
      approved: false,
      reason: "No review data",
    };
  }

  const { score, approved: explicitlyApproved } = review;

  if (config.requireExplicitApproval) {
    return {
      score,
      approved: explicitlyApproved,
      reason: explicitlyApproved
        ? "Reviewer explicitly approved"
        : `Reviewer did not explicitly approve (score: ${score}/10)`,
    };
  }

  // Standard mode: approve if score meets threshold OR explicit approval
  const meetsThreshold = score >= config.threshold;
  const approved = meetsThreshold || explicitlyApproved;

  if (approved) {
    if (explicitlyApproved && meetsThreshold) {
      return {
        score,
        approved: true,
        reason: `Approved (score: ${score}/10, explicitly approved)`,
      };
    }
    if (explicitlyApproved) {
      return {
        score,
        approved: true,
        reason: `Approved (explicitly approved, score: ${score}/10)`,
      };
    }
    return {
      score,
      approved: true,
      reason: `Approved (score: ${score}/10 meets threshold of ${config.threshold})`,
    };
  }

  const issueCount = review.issues.length;
  const issueNote = issueCount > 0 ? `, ${issueCount} issue${issueCount === 1 ? "" : "s"}` : "";
  return {
    score,
    approved: false,
    reason: `Not approved (score: ${score}/10, threshold: ${config.threshold}${issueNote})`,
  };
}
