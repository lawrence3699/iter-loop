import { join } from "node:path";
import { ensureDir, appendJsonl, readJsonl, truncateFile } from "../utils/fs.js";
import { subscriberToSafeName } from "./store.js";
import type { BusEvent } from "./event-bus.js";

/**
 * Manages per-subscriber message queues.
 *
 * Each subscriber has a directory under `bus/queues/{safeName}/`
 * containing a `pending.jsonl` file with queued events.
 */
export class QueueManager {
  readonly busDir: string;
  private readonly queuesDir: string;
  private readonly offsetsDir: string;

  constructor(busDir: string) {
    this.busDir = busDir;
    this.queuesDir = join(busDir, "queues");
    this.offsetsDir = join(busDir, "offsets");
  }

  /**
   * Enqueue an event for a subscriber.
   */
  async enqueue(subscriberId: string, event: BusEvent): Promise<void> {
    await this.ensureQueue(subscriberId);
    const pendingPath = this.getPendingPath(subscriberId);
    await appendJsonl(pendingPath, event);
  }

  /**
   * Dequeue all pending events for a subscriber (read and clear).
   */
  async dequeue(subscriberId: string): Promise<BusEvent[]> {
    const pendingPath = this.getPendingPath(subscriberId);
    const events = await readJsonl<BusEvent>(pendingPath);
    if (events.length > 0) {
      await truncateFile(pendingPath);
    }
    return events;
  }

  /**
   * Peek at pending events without removing them.
   */
  async peek(subscriberId: string): Promise<BusEvent[]> {
    const pendingPath = this.getPendingPath(subscriberId);
    return readJsonl<BusEvent>(pendingPath);
  }

  /**
   * Clear all pending events for a subscriber.
   */
  async clear(subscriberId: string): Promise<void> {
    const pendingPath = this.getPendingPath(subscriberId);
    await truncateFile(pendingPath);
  }

  /**
   * Ensure the queue directory exists for a subscriber.
   */
  async ensureQueue(subscriberId: string): Promise<void> {
    const safeName = subscriberToSafeName(subscriberId);
    await ensureDir(join(this.queuesDir, safeName));
  }

  /**
   * Get the path to a subscriber's pending file.
   */
  getPendingPath(subscriberId: string): string {
    const safeName = subscriberToSafeName(subscriberId);
    return join(this.queuesDir, safeName, "pending.jsonl");
  }

  /**
   * Get the path to a subscriber's queue directory.
   */
  getQueueDir(subscriberId: string): string {
    const safeName = subscriberToSafeName(subscriberId);
    return join(this.queuesDir, safeName);
  }

  /**
   * Get the consumption offset for a subscriber.
   */
  async getOffset(subscriberId: string): Promise<number> {
    const safeName = subscriberToSafeName(subscriberId);
    const offsetPath = join(this.offsetsDir, `${safeName}.offset`);
    try {
      const { readFile } = await import("node:fs/promises");
      const content = await readFile(offsetPath, "utf8");
      const parsed = parseInt(content.trim(), 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Set the consumption offset for a subscriber.
   */
  async setOffset(subscriberId: string, seq: number): Promise<void> {
    const safeName = subscriberToSafeName(subscriberId);
    const offsetPath = join(this.offsetsDir, `${safeName}.offset`);
    await ensureDir(this.offsetsDir);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(offsetPath, `${seq}\n`, "utf8");
  }
}
