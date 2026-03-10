import stripAnsiModule from "strip-ansi";

/**
 * Strip all ANSI escape sequences from a string.
 * Delegates to the battle-tested `strip-ansi` package for robust PTY handling.
 */
export function stripAnsi(s: string): string {
  return stripAnsiModule(s);
}

/**
 * Returns true if the string consists entirely of ANSI escape codes
 * (i.e., stripping them yields an empty string).
 */
export function isAnsiOnly(s: string): boolean {
  return s.length > 0 && stripAnsiModule(s).length === 0;
}
