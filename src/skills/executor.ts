import { type Skill } from "./loader.js";

/**
 * Inject skill content into a prompt.
 * Each skill is wrapped with delimiters for clarity.
 */
export function injectSkills(prompt: string, skills: Skill[]): string {
  if (skills.length === 0) return prompt;

  const skillBlocks = skills.map((skill) =>
    `--- SKILL: ${skill.name} ---\n${skill.content}\n--- END SKILL ---`,
  );

  return skillBlocks.join("\n\n") + "\n\n" + prompt;
}
