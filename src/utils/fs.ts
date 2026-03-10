import { mkdir, appendFile, readFile, writeFile, access, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Ensure a directory exists, creating it recursively if needed.
 */
export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/**
 * Append a JSON object as a single line to a JSONL file.
 */
export async function appendJsonl(filePath: string, data: unknown): Promise<void> {
  await ensureDir(dirname(filePath));
  const line = JSON.stringify(data) + "\n";
  await appendFile(filePath, line, "utf8");
}

/**
 * Read all lines from a JSONL file, parsing each as JSON.
 * Returns an empty array if the file does not exist.
 */
export async function readJsonl<T>(filePath: string): Promise<T[]> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return [];
    }
    throw err;
  }

  const lines = content.trim().split("\n").filter(Boolean);
  const results: T[] = [];

  for (const line of lines) {
    try {
      results.push(JSON.parse(line) as T);
    } catch {
      // Skip malformed lines
    }
  }

  return results;
}

/**
 * Atomically write a file by writing to a temp file then renaming.
 */
export async function safeWriteFile(filePath: string, content: string): Promise<void> {
  await ensureDir(dirname(filePath));
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  try {
    await writeFile(tmpPath, content, "utf8");
    await rename(tmpPath, filePath);
  } catch (err) {
    // Clean up temp file on failure
    try {
      await unlink(tmpPath);
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Read a file's contents, returning null if it does not exist.
 */
export async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

/**
 * Check if a file exists.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Truncate a file to empty (or create it if it doesn't exist).
 */
export async function truncateFile(filePath: string): Promise<void> {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, "", "utf8");
}

/**
 * Read the last non-empty line from a file.
 */
export async function readLastLine(filePath: string): Promise<string | null> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    return null;
  }
  const lines = content.trim().split("\n").filter(Boolean);
  return lines.length > 0 ? lines[lines.length - 1]! : null;
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
