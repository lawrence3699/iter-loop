import { randomBytes } from "node:crypto";
import { BusStore } from "./store.js";
import { isProcessAlive } from "../utils/process.js";

/**
 * Metadata tracked for each agent on the bus.
 */
export interface AgentMetadata {
  agent_type: string;
  nickname: string;
  status: "active" | "inactive";
  joined_at: string;
  last_seen: string;
  pid: number;
  tty?: string;
  tmux_pane?: string;
  launch_mode: string;
  activity_state: string;
  last_activity?: string;
}

/**
 * Manages subscriber registration, lifecycle, and metadata.
 *
 * Subscriber IDs follow the format `{agentType}:{randomId}`,
 * e.g. "claude:abc12345".
 */
export class SubscriberManager {
  private store: BusStore;
  private agents: Map<string, AgentMetadata> = new Map();

  constructor(store: BusStore) {
    this.store = store;
  }

  /**
   * Load agent data from disk into memory.
   */
  async load(): Promise<void> {
    this.agents = await this.store.loadAgents();
  }

  /**
   * Persist agent data to disk.
   */
  async save(): Promise<void> {
    await this.store.saveAgents(this.agents);
  }

  /**
   * Register a new agent on the bus.
   * Returns the generated subscriber ID.
   */
  async register(agentType: string, metadata: Partial<AgentMetadata> = {}): Promise<string> {
    await this.load();

    const sessionId = randomBytes(4).toString("hex");
    const subscriberId = `${agentType}:${sessionId}`;
    const now = new Date().toISOString();

    // Generate a unique nickname
    const nickname = metadata.nickname || this.generateNickname(agentType);

    const agentMeta: AgentMetadata = {
      agent_type: agentType,
      nickname,
      status: "active",
      joined_at: now,
      last_seen: now,
      pid: metadata.pid ?? process.pid,
      tty: metadata.tty,
      tmux_pane: metadata.tmux_pane,
      launch_mode: metadata.launch_mode ?? "",
      activity_state: metadata.activity_state ?? "starting",
      last_activity: metadata.last_activity,
    };

    this.agents.set(subscriberId, agentMeta);

    // Ensure queue directory exists
    await this.store.ensureQueue(subscriberId);
    await this.save();

    return subscriberId;
  }

  /**
   * Unregister an agent, marking it as inactive.
   */
  async unregister(subscriberId: string): Promise<void> {
    await this.load();

    const meta = this.agents.get(subscriberId);
    if (!meta) return;

    meta.status = "inactive";
    meta.last_seen = new Date().toISOString();

    await this.save();
  }

  /**
   * Rename a subscriber's nickname.
   */
  async rename(subscriberId: string, nickname: string): Promise<void> {
    await this.load();

    const meta = this.agents.get(subscriberId);
    if (!meta) {
      throw new Error(`Subscriber "${subscriberId}" not found`);
    }

    // Check for nickname conflicts
    for (const [id, other] of this.agents) {
      if (id !== subscriberId && other.nickname === nickname && other.status === "active") {
        throw new Error(`Nickname "${nickname}" is already in use by ${id}`);
      }
    }

    meta.nickname = nickname;
    await this.save();
  }

  /**
   * Update specific metadata fields for a subscriber.
   */
  async updateMetadata(subscriberId: string, updates: Partial<AgentMetadata>): Promise<void> {
    await this.load();

    const meta = this.agents.get(subscriberId);
    if (!meta) {
      throw new Error(`Subscriber "${subscriberId}" not found`);
    }

    if (updates.status !== undefined) meta.status = updates.status;
    if (updates.last_seen !== undefined) meta.last_seen = updates.last_seen;
    if (updates.pid !== undefined) meta.pid = updates.pid;
    if (updates.tty !== undefined) meta.tty = updates.tty;
    if (updates.tmux_pane !== undefined) meta.tmux_pane = updates.tmux_pane;
    if (updates.launch_mode !== undefined) meta.launch_mode = updates.launch_mode;
    if (updates.activity_state !== undefined) meta.activity_state = updates.activity_state;
    if (updates.last_activity !== undefined) meta.last_activity = updates.last_activity;
    if (updates.nickname !== undefined) meta.nickname = updates.nickname;

    await this.save();
  }

  /**
   * Clean up subscribers whose processes are no longer alive.
   * Returns the list of subscriber IDs that were marked inactive.
   */
  async cleanupInactive(): Promise<string[]> {
    await this.load();

    const cleaned: string[] = [];

    for (const [id, meta] of this.agents) {
      if (meta.status !== "active") continue;

      // If the agent has a PID, check if it's still alive
      if (meta.pid > 0 && !isProcessAlive(meta.pid)) {
        meta.status = "inactive";
        meta.last_seen = new Date().toISOString();
        cleaned.push(id);
      }
    }

    if (cleaned.length > 0) {
      await this.save();
    }

    return cleaned;
  }

  /**
   * List all agents (both active and inactive).
   */
  async list(): Promise<Map<string, AgentMetadata>> {
    await this.load();
    return new Map(this.agents);
  }

  /**
   * Get metadata for a specific subscriber.
   */
  async get(subscriberId: string): Promise<AgentMetadata | undefined> {
    await this.load();
    return this.agents.get(subscriberId);
  }

  /**
   * Generate a unique auto-nickname for the given agent type.
   * Format: {prefix}-{N} where N is the lowest unused integer.
   */
  private generateNickname(agentType: string): string {
    const prefix = this.nicknamePrefix(agentType);
    const usedNicknames = new Set<string>();

    for (const meta of this.agents.values()) {
      if (meta.status === "active" && meta.nickname) {
        usedNicknames.add(meta.nickname);
      }
    }

    let idx = 1;
    while (usedNicknames.has(`${prefix}-${idx}`)) {
      idx++;
    }

    return `${prefix}-${idx}`;
  }

  /**
   * Get the nickname prefix for a given agent type.
   */
  private nicknamePrefix(agentType: string): string {
    switch (agentType) {
      case "claude":
      case "claude-code":
        return "claude";
      case "gemini":
        return "gemini";
      case "codex":
        return "codex";
      default:
        return agentType || "agent";
    }
  }
}
