import { join, basename } from "node:path";
import { BusStore } from "./store.js";
import { QueueManager } from "./queue.js";
import { SubscriberManager, type AgentMetadata } from "./subscriber.js";
import { MessageManager } from "./message.js";

/**
 * A single event on the bus.
 */
export interface BusEvent {
  seq: number;
  timestamp: string;
  type: string;
  event: string;
  publisher: string;
  target: string;
  data: Record<string, unknown>;
}

/**
 * Summary status of the bus.
 */
export interface BusStatus {
  id: string;
  agents: number;
  events: number;
  agentList: Array<{ id: string; type: string; nickname: string; status: string }>;
}

/**
 * The main EventBus class. Orchestrates store, queue, subscriber, and
 * message managers to provide a unified API for agent communication.
 */
export class EventBus {
  readonly projectRoot: string;
  readonly busDir: string;

  private store: BusStore;
  private subscriberManager: SubscriberManager;
  private messageManager: MessageManager;
  private queueManager: QueueManager;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.busDir = join(projectRoot, ".loop", "bus");

    this.store = new BusStore(this.busDir);
    this.subscriberManager = new SubscriberManager(this.store);
    this.messageManager = new MessageManager(this.busDir, this.subscriberManager);
    this.queueManager = new QueueManager(this.busDir);
  }

  /**
   * Initialize the event bus (create directory structure, etc).
   */
  async init(): Promise<void> {
    await this.store.init();
  }

  /**
   * Gracefully shut down the event bus.
   */
  async shutdown(): Promise<void> {
    // Currently a no-op; future: close file handles, flush buffers
  }

  /**
   * Send a targeted message from a publisher to a target.
   */
  async send(publisher: string, target: string, message: string): Promise<BusEvent> {
    return this.messageManager.createEvent(
      publisher,
      target,
      { message },
      "message/targeted",
    );
  }

  /**
   * Broadcast a message from a publisher to all active agents.
   */
  async broadcast(publisher: string, message: string): Promise<BusEvent> {
    return this.messageManager.createEvent(
      publisher,
      "*",
      { message },
      "message/broadcast",
    );
  }

  /**
   * Join an agent to the bus.
   * Returns the subscriber ID.
   */
  async join(agentType: string, metadata?: Partial<AgentMetadata>): Promise<string> {
    return this.subscriberManager.register(agentType, metadata);
  }

  /**
   * Remove an agent from the bus (mark as inactive).
   */
  async leave(subscriberId: string): Promise<void> {
    await this.subscriberManager.unregister(subscriberId);
  }

  /**
   * Peek at pending messages for a subscriber without consuming them.
   */
  async check(subscriberId: string): Promise<BusEvent[]> {
    // Update last_seen on check
    try {
      await this.subscriberManager.updateMetadata(subscriberId, {
        last_seen: new Date().toISOString(),
      });
    } catch {
      // Ignore - subscriber may not be registered
    }
    return this.queueManager.peek(subscriberId);
  }

  /**
   * Consume (read and clear) pending messages for a subscriber.
   */
  async consume(subscriberId: string): Promise<BusEvent[]> {
    // Update last_seen on consume
    try {
      await this.subscriberManager.updateMetadata(subscriberId, {
        last_seen: new Date().toISOString(),
      });
    } catch {
      // Ignore - subscriber may not be registered
    }
    return this.queueManager.dequeue(subscriberId);
  }

  /**
   * Get the current status of the bus.
   */
  async status(): Promise<BusStatus> {
    // Clean up dead agents first
    await this.subscriberManager.cleanupInactive();

    const agents = await this.subscriberManager.list();
    const totalEvents = await this.store.countEvents();

    const agentList: BusStatus["agentList"] = [];
    let activeCount = 0;

    for (const [id, meta] of agents) {
      agentList.push({
        id,
        type: meta.agent_type,
        nickname: meta.nickname,
        status: meta.status,
      });
      if (meta.status === "active") {
        activeCount++;
      }
    }

    return {
      id: basename(this.projectRoot) || "loop-workspace",
      agents: activeCount,
      events: totalEvents,
      agentList,
    };
  }

  /**
   * Get all registered agents.
   */
  async agents(): Promise<Map<string, AgentMetadata>> {
    return this.subscriberManager.list();
  }

  /**
   * Resolve a target to subscriber IDs (exposed for daemon/orchestrator use).
   */
  async resolveTarget(target: string): Promise<string[]> {
    return this.messageManager.resolveTarget(target);
  }

  /**
   * Get the subscriber manager (for orchestrator access).
   */
  getSubscriberManager(): SubscriberManager {
    return this.subscriberManager;
  }

  /**
   * Get the message manager (for orchestrator access).
   */
  getMessageManager(): MessageManager {
    return this.messageManager;
  }

  /**
   * Get the queue manager (for daemon access).
   */
  getQueueManager(): QueueManager {
    return this.queueManager;
  }

  /**
   * Get the store (for direct access when needed).
   */
  getStore(): BusStore {
    return this.store;
  }
}
