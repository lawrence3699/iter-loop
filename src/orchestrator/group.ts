import { OrchestratorDaemon } from "./daemon.js";
import type { EventBus } from "../bus/event-bus.js";

/**
 * Describes a single agent within a group.
 */
export interface GroupAgent {
  /** Display name / nickname for this agent */
  name: string;
  /** Agent engine type (e.g. "claude", "gemini", "codex") */
  engine: string;
  /** Optional role description */
  role?: string;
}

/**
 * Describes a group of agents to be launched together.
 */
export interface AgentGroup {
  /** Unique group name */
  name: string;
  /** Agents in this group */
  agents: GroupAgent[];
  /** How agents are executed */
  strategy: "parallel" | "sequential" | "pipeline";
}

/** Runtime state for a group member */
interface GroupMemberState {
  name: string;
  engine: string;
  subscriberId: string;
  status: "pending" | "active" | "stopped" | "failed";
  launchedAt: string;
  stoppedAt: string;
}

/** Runtime state for a group */
interface GroupState {
  name: string;
  status: "starting" | "active" | "stopped" | "failed";
  strategy: "parallel" | "sequential" | "pipeline";
  members: GroupMemberState[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Orchestrates groups of agents: launching them according to a strategy,
 * tracking their lifecycle, and stopping them together.
 */
export class GroupOrchestrator {
  private readonly daemon: OrchestratorDaemon;
  private groups: Map<string, GroupState> = new Map();

  constructor(daemon: OrchestratorDaemon) {
    this.daemon = daemon;
  }

  /**
   * Launch a group of agents.
   * Returns the subscriber IDs of all launched agents.
   */
  async launchGroup(group: AgentGroup): Promise<string[]> {
    const eventBus = this.daemon.getEventBus();
    const now = new Date().toISOString();

    const state: GroupState = {
      name: group.name,
      status: "starting",
      strategy: group.strategy,
      members: group.agents.map((agent) => ({
        name: agent.name,
        engine: agent.engine,
        subscriberId: "",
        status: "pending",
        launchedAt: "",
        stoppedAt: "",
      })),
      createdAt: now,
      updatedAt: now,
    };

    this.groups.set(group.name, state);
    const subscriberIds: string[] = [];

    try {
      switch (group.strategy) {
        case "parallel": {
          // Launch all agents concurrently
          const promises = group.agents.map(async (agent, idx) => {
            const subscriberId = await this.launchSingleAgent(eventBus, agent);
            const member = state.members[idx];
            if (member) {
              member.subscriberId = subscriberId;
              member.status = "active";
              member.launchedAt = new Date().toISOString();
            }
            return subscriberId;
          });

          const results = await Promise.allSettled(promises);
          for (let i = 0; i < results.length; i++) {
            const result = results[i]!;
            if (result.status === "fulfilled") {
              subscriberIds.push(result.value);
            } else {
              const member = state.members[i];
              if (member) {
                member.status = "failed";
              }
            }
          }
          break;
        }

        case "sequential":
        case "pipeline": {
          // Launch agents one at a time in order
          for (let i = 0; i < group.agents.length; i++) {
            const agent = group.agents[i]!;
            const member = state.members[i]!;

            try {
              const subscriberId = await this.launchSingleAgent(eventBus, agent);
              member.subscriberId = subscriberId;
              member.status = "active";
              member.launchedAt = new Date().toISOString();
              subscriberIds.push(subscriberId);
            } catch {
              member.status = "failed";
              // For pipeline, stop on first failure
              if (group.strategy === "pipeline") {
                state.status = "failed";
                state.updatedAt = new Date().toISOString();
                this.groups.set(group.name, state);
                return subscriberIds;
              }
            }
          }
          break;
        }
      }

      // Determine overall group status
      const allActive = state.members.every((m) => m.status === "active");
      const anyFailed = state.members.some((m) => m.status === "failed");
      state.status = allActive ? "active" : anyFailed ? "failed" : "active";
      state.updatedAt = new Date().toISOString();
      this.groups.set(group.name, state);
    } catch (err) {
      state.status = "failed";
      state.updatedAt = new Date().toISOString();
      this.groups.set(group.name, state);
      throw err;
    }

    return subscriberIds;
  }

  /**
   * Stop all agents in a group.
   */
  async stopGroup(name: string): Promise<void> {
    const state = this.groups.get(name);
    if (!state) {
      throw new Error(`Group "${name}" not found`);
    }

    const eventBus = this.daemon.getEventBus();

    // Stop in reverse order
    for (let i = state.members.length - 1; i >= 0; i--) {
      const member = state.members[i]!;
      if (member.status !== "active" || !member.subscriberId) continue;

      try {
        await eventBus.leave(member.subscriberId);
        member.status = "stopped";
        member.stoppedAt = new Date().toISOString();
      } catch {
        // Best effort - continue stopping others
      }
    }

    state.status = "stopped";
    state.updatedAt = new Date().toISOString();
    this.groups.set(name, state);
  }

  /**
   * List all known groups and their current state.
   */
  async listGroups(): Promise<AgentGroup[]> {
    const groups: AgentGroup[] = [];
    for (const state of this.groups.values()) {
      groups.push({
        name: state.name,
        strategy: state.strategy,
        agents: state.members.map((m) => ({
          name: m.name,
          engine: m.engine,
        })),
      });
    }
    return groups;
  }

  /**
   * Get the state of a specific group.
   */
  getGroupState(name: string): GroupState | undefined {
    return this.groups.get(name);
  }

  /**
   * Launch a single agent on the bus, returning its subscriber ID.
   */
  private async launchSingleAgent(eventBus: EventBus, agent: GroupAgent): Promise<string> {
    return eventBus.join(agent.engine, {
      nickname: agent.name,
      activity_state: "starting",
    });
  }
}
