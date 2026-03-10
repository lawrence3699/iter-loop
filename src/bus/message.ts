import { join } from "node:path";
import { nextSeq } from "../utils/lock.js";
import { appendJsonl } from "../utils/fs.js";
import { SubscriberManager } from "./subscriber.js";
import { QueueManager } from "./queue.js";
import type { BusEvent } from "./event-bus.js";

/**
 * Manages message creation, routing, and delivery.
 *
 * Target resolution order:
 *   1. Exact subscriber ID match (e.g. "claude:abc123")
 *   2. Nickname match (e.g. "claude-1")
 *   3. Agent type match (e.g. "claude" -> all active claude agents)
 *   4. Broadcast ("*" -> all active agents)
 */
export class MessageManager {
  private readonly eventsDir: string;
  private readonly seqFile: string;
  private readonly seqLockFile: string;
  private readonly subscriberManager: SubscriberManager;
  private readonly queueManager: QueueManager;

  constructor(busDir: string, subscriberManager: SubscriberManager) {
    this.eventsDir = join(busDir, "events");
    this.seqFile = join(busDir, "seq.counter");
    this.seqLockFile = join(busDir, "seq.counter.lock");
    this.subscriberManager = subscriberManager;
    this.queueManager = new QueueManager(busDir);
  }

  /**
   * Get the next monotonically increasing sequence number.
   */
  async nextSeq(): Promise<number> {
    return nextSeq(this.seqFile, this.seqLockFile);
  }

  /**
   * Resolve a target string to a list of subscriber IDs.
   *
   * Resolution order:
   *   1. Exact subscriber ID match
   *   2. Nickname match
   *   3. Agent type match (all active agents of that type)
   *   4. Broadcast "*" (all active agents)
   */
  async resolveTarget(target: string): Promise<string[]> {
    const agents = await this.subscriberManager.list();

    // 1. Exact subscriber ID match
    if (agents.has(target)) {
      return [target];
    }

    // 2. If contains ":", treat as subscriber ID even if not in registry
    if (target.includes(":")) {
      return [target];
    }

    // 3. Nickname match
    for (const [id, meta] of agents) {
      if (meta.nickname === target && meta.status === "active") {
        return [id];
      }
    }

    // 4. Agent type match
    const byType: string[] = [];
    for (const [id, meta] of agents) {
      if (meta.agent_type === target && meta.status === "active") {
        byType.push(id);
      }
    }
    if (byType.length > 0) {
      return byType;
    }

    // 5. Broadcast
    if (target === "*") {
      const all: string[] = [];
      for (const [id, meta] of agents) {
        if (meta.status === "active") {
          all.push(id);
        }
      }
      return all;
    }

    return [];
  }

  /**
   * Route an event to its target subscribers' queues.
   */
  async route(event: BusEvent): Promise<void> {
    const targets = await this.resolveTarget(event.target);

    for (const subscriberId of targets) {
      // Check offset to avoid re-delivering already-consumed events
      const offset = await this.queueManager.getOffset(subscriberId);
      if (event.seq > offset) {
        await this.queueManager.enqueue(subscriberId, event);
      }
    }
  }

  /**
   * Create and persist a new event, then route it to targets.
   * Returns the created event.
   */
  async createEvent(
    publisher: string,
    target: string,
    data: Record<string, unknown>,
    type: string = "message/targeted",
  ): Promise<BusEvent> {
    const seq = await this.nextSeq();
    const timestamp = new Date().toISOString();
    const date = timestamp.slice(0, 10);

    // Resolve to verify target exists
    const targets = await this.resolveTarget(target);
    if (targets.length === 0) {
      throw new Error(`Target "${target}" not found`);
    }

    const event: BusEvent = {
      seq,
      timestamp,
      type,
      event: data.message !== undefined ? "message" : "event",
      publisher,
      target,
      data,
    };

    // Write to the event log
    const eventFile = join(this.eventsDir, `${date}.jsonl`);
    await appendJsonl(eventFile, event);

    // Route to target queues
    await this.route(event);

    return event;
  }

  /**
   * Get the queue manager (needed by EventBus for consume operations).
   */
  getQueueManager(): QueueManager {
    return this.queueManager;
  }
}
