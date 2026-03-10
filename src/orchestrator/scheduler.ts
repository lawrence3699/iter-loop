import { SubscriberManager, type AgentMetadata } from "../bus/subscriber.js";

/**
 * Simple activity-aware task scheduler.
 *
 * Routes tasks to idle agents, preferring agents that have been idle
 * the longest. Falls back to the least-recently-active agent if none
 * are idle.
 */
export class Scheduler {
  private readonly subscriberManager: SubscriberManager;

  constructor(subscriberManager: SubscriberManager) {
    this.subscriberManager = subscriberManager;
  }

  /**
   * Assign a task to the best available agent.
   *
   * @param task - Description of the task (for logging; not persisted here)
   * @param preferredAgent - Optional subscriber ID or agent type to prefer
   * @returns The subscriber ID of the assigned agent, or null if none available
   */
  async assignTask(_task: string, preferredAgent?: string): Promise<string | null> {
    const agents = await this.subscriberManager.list();

    // Filter to active agents only
    const active: Array<[string, AgentMetadata]> = [];
    for (const [id, meta] of agents) {
      if (meta.status === "active") {
        active.push([id, meta]);
      }
    }

    if (active.length === 0) return null;

    // If a preferred agent is specified, check it first
    if (preferredAgent) {
      // Try exact match
      const exact = active.find(([id]) => id === preferredAgent);
      if (exact) return exact[0];

      // Try nickname match
      const byNickname = active.find(([, meta]) => meta.nickname === preferredAgent);
      if (byNickname) return byNickname[0];

      // Try agent type match (pick idle one of that type)
      const byType = active.filter(([, meta]) => meta.agent_type === preferredAgent);
      if (byType.length > 0) {
        const idle = byType.find(([, meta]) => meta.activity_state === "idle");
        if (idle) return idle[0];
        return byType[0]![0]; // Fallback to first of type
      }
    }

    // Prefer idle agents
    return this.routeToIdleFromList(active);
  }

  /**
   * Find the best idle agent to route work to.
   *
   * @returns The subscriber ID of an idle agent, or null if none available
   */
  async routeToIdle(): Promise<string | null> {
    const agents = await this.subscriberManager.list();
    const active: Array<[string, AgentMetadata]> = [];
    for (const [id, meta] of agents) {
      if (meta.status === "active") {
        active.push([id, meta]);
      }
    }
    return this.routeToIdleFromList(active);
  }

  /**
   * From a list of active agents, pick the best one to receive work.
   * Prefers idle agents; among idle agents, picks the one idle longest.
   */
  private routeToIdleFromList(active: Array<[string, AgentMetadata]>): string | null {
    if (active.length === 0) return null;

    // Separate idle from working
    const idle = active.filter(([, meta]) => meta.activity_state === "idle");

    if (idle.length > 0) {
      // Pick the agent that has been idle the longest (oldest last_activity)
      idle.sort((a, b) => {
        const aTime = a[1].last_activity ?? a[1].last_seen;
        const bTime = b[1].last_activity ?? b[1].last_seen;
        return (aTime ?? "").localeCompare(bTime ?? "");
      });
      return idle[0]![0];
    }

    // No idle agents - pick least recently active (might finish soonest)
    const sorted = [...active].sort((a, b) => {
      const aTime = a[1].last_activity ?? a[1].last_seen;
      const bTime = b[1].last_activity ?? b[1].last_seen;
      return (aTime ?? "").localeCompare(bTime ?? "");
    });

    return sorted[0]![0];
  }
}
