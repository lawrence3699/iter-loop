import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

export interface Skill {
  name: string;
  description: string;
  content: string;
  path: string;
  scope: "global" | "project" | "builtin";
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = join(__dirname, "..", "..");

function readSkillFile(skillDir: string, scope: Skill["scope"]): Skill | null {
  const skillPath = join(skillDir, "SKILL.md");
  if (!existsSync(skillPath)) return null;

  try {
    const raw = readFileSync(skillPath, "utf-8");
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;

    const name =
      typeof data.name === "string" && data.name
        ? data.name
        : skillDir.split("/").pop() ?? "unknown";

    const description =
      typeof data.description === "string"
        ? data.description.trim()
        : "";

    return {
      name,
      description,
      content: parsed.content.trim(),
      path: skillPath,
      scope,
    };
  } catch {
    return null;
  }
}

function discoverFromDir(
  baseDir: string,
  scope: Skill["scope"],
): Skill[] {
  if (!existsSync(baseDir)) return [];

  const skills: Skill[] = [];
  try {
    const entries = readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skill = readSkillFile(join(baseDir, entry.name), scope);
        if (skill) {
          skills.push(skill);
        }
      }
    }
  } catch {
    // Directory not readable — skip
  }

  return skills;
}

/**
 * Discover skills from multiple locations.
 * Search order (later scopes override earlier on name collision):
 * 1. Built-in: <packageRoot>/skills/<name>/SKILL.md
 * 2. Global:   ~/.loop/skills/<name>/SKILL.md
 * 3. Project:  <cwd>/SKILLS/<name>/SKILL.md
 */
export async function discoverSkills(cwd: string): Promise<Skill[]> {
  const seen = new Map<string, Skill>();

  // 1. Built-in skills
  const builtinDir = join(PACKAGE_ROOT, "skills");
  for (const skill of discoverFromDir(builtinDir, "builtin")) {
    seen.set(skill.name, skill);
  }

  // 2. Global skills (~/.loop/skills/)
  const globalDir = join(homedir(), ".loop", "skills");
  for (const skill of discoverFromDir(globalDir, "global")) {
    seen.set(skill.name, skill);
  }

  // 3. Project skills (<cwd>/SKILLS/)
  const projectDir = join(cwd, "SKILLS");
  for (const skill of discoverFromDir(projectDir, "project")) {
    seen.set(skill.name, skill);
  }

  return Array.from(seen.values());
}
