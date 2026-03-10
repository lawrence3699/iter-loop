import gradient from "gradient-string";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { orange, gBlue, gGreen, dim, bold } from "./colors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "..", "..", "package.json"), "utf-8"),
    ) as { version: string };
    return `v${pkg.version}`;
  } catch {
    return "v0.0.0";
  }
}

// 5-line block-letter logo for "loop"
const LARGE_LOGO = [
  " ██╗      ██████╗  ██████╗ ██████╗ ",
  " ██║     ██╔═══██╗██╔═══██╗██╔══██╗",
  " ██║     ██║   ██║██║   ██║██████╔╝",
  " ██║     ██║   ██║██║   ██║██╔═══╝ ",
  " ███████╗╚██████╔╝╚██████╔╝██║     ",
  " ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝     ",
];

const loopGradient = gradient(["#F07623", "#4285F4", "#10A37F"]);

interface EngineStatus {
  name: string;
  label: string;
  version: string | null;
  colorFn: (s: string) => string;
}

function detectEngines(): EngineStatus[] {
  const engines: { cmd: string; label: string; colorFn: (s: string) => string }[] = [
    { cmd: "claude", label: "Claude", colorFn: orange },
    { cmd: "gemini", label: "Gemini", colorFn: gBlue },
    { cmd: "codex",  label: "Codex",  colorFn: gGreen },
  ];

  return engines.map(({ cmd, label, colorFn }) => {
    let version: string | null = null;
    try {
      version = execFileSync(cmd, ["--version"], {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
    } catch {
      // not installed
    }
    return { name: cmd, label, version, colorFn };
  });
}

export function renderBanner(): string {
  const cols = process.stdout.columns || 80;
  const engines = detectEngines();

  if (cols >= 50) {
    return renderLarge(cols, engines);
  } else {
    return renderCompact(cols, engines);
  }
}

export function renderEngineStatus(): void {
  const engines = detectEngines();
  for (const e of engines) {
    const dot = e.version ? e.colorFn("\u25CF") : dim("\u25CB");
    const label = e.version ? e.colorFn(e.label) : dim(e.label);
    const ver = e.version ? dim(` (${e.version})`) : dim(" (not found)");
    console.log(`   ${dot} ${label}${ver}`);
  }
}

function renderLarge(cols: number, engines: EngineStatus[]): string {
  const VERSION = getVersion();
  const maxLogoWidth = Math.max(...LARGE_LOGO.map((l) => l.length));
  const boxWidth = maxLogoWidth + 6;
  const hBar = "\u2550".repeat(boxWidth - 2);

  const frameLine = (content: string, visibleLen?: number): string => {
    const vLen =
      visibleLen ?? content.replace(/\x1b\[[0-9;]*m/g, "").length;
    const padding = Math.max(0, boxWidth - 4 - vLen);
    return `  \u2551  ${content}${" ".repeat(padding)}\u2551`;
  };

  const emptyLine = frameLine("", 0);

  // Apply gradient to logo lines
  const logoLines = LARGE_LOGO.map((line) => {
    const padded = line + " ".repeat(maxLogoWidth - line.length);
    const gradientLine = loopGradient(padded);
    return frameLine(gradientLine, maxLogoWidth);
  });

  // Tagline + version on same line
  const tagline = "Iterative multi-engine AI orchestration";
  const version = VERSION;
  const innerWidth = boxWidth - 4;
  const tagVersionGap = Math.max(1, innerWidth - tagline.length - version.length);
  const tagVersionLine = `  \u2551  ${dim(tagline)}${" ".repeat(tagVersionGap)}${bold(version)}\u2551`;

  // Engine status lines
  const engineLines = engines.map((e) => {
    const dot = e.version ? e.colorFn("\u25CF") : dim("\u25CB");
    const label = e.version ? e.colorFn(e.label) : dim(e.label);
    const ver = e.version ? dim(` (${e.version})`) : dim(" (not found)");
    const content = `   ${dot} ${label}${ver}`;
    const visLen =
      5 + e.label.length + (e.version ? ` (${e.version})`.length : " (not found)".length);
    return frameLine(content, visLen);
  });

  // Build engine header
  const engLabel = "  Engines";
  const engLabelLine = `  \u2551${dim(engLabel)}${" ".repeat(Math.max(0, boxWidth - 2 - engLabel.length))}\u2551`;

  // Adapt to small columns by not rendering if too narrow
  if (cols < boxWidth + 4) {
    return renderCompact(cols, engines);
  }

  return [
    "",
    `  \u2554${hBar}\u2557`,
    emptyLine,
    ...logoLines,
    emptyLine,
    tagVersionLine,
    emptyLine,
    `  \u2560${hBar}\u2563`,
    engLabelLine,
    emptyLine,
    ...engineLines,
    emptyLine,
    `  \u255A${hBar}\u255D`,
    "",
  ].join("\n");
}

function renderCompact(cols: number, engines: EngineStatus[]): string {
  const VERSION = getVersion();
  const boxWidth = Math.min(cols - 2, 40);
  const hBar = "\u2550".repeat(Math.max(0, boxWidth - 2));

  const engineDots = engines
    .map((e) => {
      const dot = e.version ? e.colorFn("\u25CF") : dim("\u25CB");
      return `${dot} ${e.version ? e.colorFn(e.label) : dim(e.label)}`;
    })
    .join("  ");

  const title = loopGradient("\u25C8 loop");
  const version = bold(VERSION);

  return [
    "",
    `  \u2554${hBar}\u2557`,
    `  \u2551  ${title}  ${version}${" ".repeat(Math.max(0, boxWidth - 20))}\u2551`,
    `  \u2551  ${dim("AI orchestration")}${" ".repeat(Math.max(0, boxWidth - 22))}\u2551`,
    `  \u2560${hBar}\u2563`,
    `  \u2551  ${engineDots}${" ".repeat(Math.max(0, boxWidth - 30))}\u2551`,
    `  \u255A${hBar}\u255D`,
    "",
  ].join("\n");
}
