import { openSync, writeSync, closeSync, readFileSync, writeFileSync, unlinkSync, statSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { isProcessAlive } from "./process.js";

const LOCK_TIMEOUT_MS = 5000;
const LOCK_POLL_MS = 25;
const LOCK_STALE_MS = 30000;

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

function cleanupStaleLock(lockPath: string): void {
  let shouldRemove = false;

  try {
    const raw = readFileSync(lockPath, "utf8").trim();
    const pid = parseInt(raw, 10);
    if (!Number.isFinite(pid) || pid <= 0) {
      shouldRemove = true;
    } else if (!isProcessAlive(pid)) {
      shouldRemove = true;
    }
  } catch {
    shouldRemove = true;
  }

  if (!shouldRemove) {
    try {
      const stat = statSync(lockPath);
      if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
        shouldRemove = true;
      }
    } catch {
      shouldRemove = true;
    }
  }

  if (shouldRemove) {
    try {
      unlinkSync(lockPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Acquire a file-based lock, execute a function, then release.
 * The lock file contains the PID of the holder.
 * Stale locks (dead PID or older than 30s) are automatically cleaned.
 */
export async function withFileLock<T>(
  lockPath: string,
  fn: () => Promise<T>,
  timeout: number = LOCK_TIMEOUT_MS,
): Promise<T> {
  mkdirSync(dirname(lockPath), { recursive: true });

  const deadline = Date.now() + timeout;
  let lockFd: number | null = null;

  while (Date.now() < deadline) {
    try {
      lockFd = openSync(lockPath, "wx");
      writeSync(lockFd, `${process.pid}\n`);
      break;
    } catch (err: unknown) {
      if (isNodeError(err) && err.code === "EEXIST") {
        cleanupStaleLock(lockPath);
        await sleep(LOCK_POLL_MS);
        continue;
      }
      throw err;
    }
  }

  if (lockFd === null) {
    throw new Error(`Failed to acquire file lock: ${lockPath} (timeout ${timeout}ms)`);
  }

  try {
    return await fn();
  } finally {
    try {
      closeSync(lockFd);
    } catch {
      // Ignore
    }
    try {
      unlinkSync(lockPath);
    } catch {
      // Ignore
    }
  }
}

/**
 * Atomically increment a counter file under a file lock.
 * If the counter file is missing or corrupt, attempts to recover from 0.
 */
export async function nextSeq(counterPath: string, lockPath: string): Promise<number> {
  return withFileLock(lockPath, async () => {
    let current = 0;
    try {
      const raw = readFileSync(counterPath, "utf8").trim();
      const parsed = parseInt(raw, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        current = parsed;
      }
    } catch {
      // Counter file missing or unreadable - start from 0
    }

    const next = current + 1;
    mkdirSync(dirname(counterPath), { recursive: true });
    writeFileSync(counterPath, `${next}\n`, "utf8");
    return next;
  });
}
