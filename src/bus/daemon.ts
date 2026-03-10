import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { EventBus } from "./event-bus.js";
import { safeNameToSubscriber } from "./store.js";

/**
 * Options for the BusDaemon.
 */
export interface BusDaemonOptions {
  /** Polling interval in milliseconds. Default: 1000 */
  pollIntervalMs?: number;
  /** How often (in poll cycles) to run cleanup. Default: 5 */
  cleanupEveryNCycles?: number;
}

/**
 * Background daemon that polls subscriber queues and delivers messages.
 *
 * In the ufoo model, the daemon checks for pending messages in queue
 * directories and delivers them to agents (via injection). In this
 * simplified version, the daemon:
 *
 * 1. Periodically cleans up dead agents
 * 2. Monitors queue directories for pending messages
 * 3. Emits delivery notifications
 */
export class BusDaemon {
  private readonly eventBus: EventBus;
  private readonly pollIntervalMs: number;
  private readonly cleanupEveryNCycles: number;
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private cleanupCounter = 0;
  private lastCounts: Map<string, number> = new Map();

  constructor(eventBus: EventBus, opts?: BusDaemonOptions) {
    this.eventBus = eventBus;
    this.pollIntervalMs = opts?.pollIntervalMs ?? 1000;
    this.cleanupEveryNCycles = opts?.cleanupEveryNCycles ?? 5;
  }

  /**
   * Start the daemon polling loop.
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.pollLoop();
  }

  /**
   * Stop the daemon.
   */
  async stop(): Promise<void> {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Check if the daemon is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Main polling loop.
   */
  private pollLoop(): void {
    if (!this.running) return;

    this.tick()
      .catch((err) => {
        // Log but don't crash
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[bus-daemon] tick error: ${message}\n`);
      })
      .finally(() => {
        if (this.running) {
          this.timer = setTimeout(() => this.pollLoop(), this.pollIntervalMs);
        }
      });
  }

  /**
   * Single tick: cleanup + check queues.
   */
  private async tick(): Promise<void> {
    // Periodic cleanup
    this.cleanupCounter++;
    if (this.cleanupCounter >= this.cleanupEveryNCycles) {
      this.cleanupCounter = 0;
      try {
        const subscriberMgr = this.eventBus.getSubscriberManager();
        await subscriberMgr.cleanupInactive();
      } catch {
        // Ignore cleanup errors
      }
    }

    // Check all queues
    await this.checkQueues();
  }

  /**
   * Check all subscriber queues for pending messages.
   */
  private async checkQueues(): Promise<void> {
    const queuesDir = join(this.eventBus.busDir, "queues");

    let entries: string[];
    try {
      entries = await readdir(queuesDir);
    } catch {
      // Queues dir may not exist yet
      return;
    }

    for (const safeName of entries) {
      const pendingPath = join(queuesDir, safeName, "pending.jsonl");

      let fileSize: number;
      try {
        const fileStat = await stat(pendingPath);
        fileSize = fileStat.size;
      } catch {
        continue; // File doesn't exist
      }

      if (fileSize === 0) continue;

      // Count current messages
      let count = 0;
      try {
        const content = await readFile(pendingPath, "utf8");
        const trimmed = content.trim();
        count = trimmed ? trimmed.split("\n").length : 0;
      } catch {
        continue;
      }

      const subscriberId = safeNameToSubscriber(safeName);
      const lastCount = this.lastCounts.get(safeName) ?? 0;

      if (count > lastCount) {
        const now = new Date().toISOString().split("T")[1]?.slice(0, 8) ?? "";
        process.stderr.write(
          `[bus-daemon] ${now} New messages for ${subscriberId} (${lastCount} -> ${count})\n`,
        );
      }

      this.lastCounts.set(safeName, count);
    }
  }
}
