import { getExecutorContext } from "./shared-plan.js";
import { listDecisions } from "./decisions.js";

/**
 * Build a unified context string combining:
 * - Last iteration score/feedback from the shared plan
 * - Active decisions
 * - File change log
 */
export async function buildContext(cwd: string): Promise<string> {
  const sections: string[] = [];

  // 1. Last iteration context from shared plan
  const iterationContext = await getExecutorContext(cwd);
  if (iterationContext) {
    sections.push(iterationContext);
  }

  // 2. Active decisions
  try {
    const decisions = await listDecisions(cwd);
    const active = decisions.filter(
      (d) => d.status === "proposed" || d.status === "accepted",
    );

    if (active.length > 0) {
      const decisionLines: string[] = [
        "## Active Decisions",
        "",
      ];
      for (const d of active) {
        decisionLines.push(
          `- **[${d.status.toUpperCase()}] #${d.id}: ${d.title}**`,
        );
        if (d.decision) {
          decisionLines.push(`  ${d.decision}`);
        }
      }
      sections.push(decisionLines.join("\n"));
    }
  } catch {
    // No decisions directory — skip
  }

  if (sections.length === 0) {
    return "";
  }

  return sections.join("\n\n");
}
