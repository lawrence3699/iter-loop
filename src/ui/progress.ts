import type { RuntimeProgressEvent } from "../core/runtime.js";
import { dim, formatBytes } from "./colors.js";

interface ProgressPrinterOptions {
  color: (s: string) => string;
  label: string;
  verbose: boolean;
  ensureLineBreak?: () => void;
}

export class RuntimeProgressPrinter {
  private readonly color: (s: string) => string;
  private readonly label: string;
  private readonly verbose: boolean;
  private readonly ensureLineBreak?: () => void;
  private lastSignature = "";

  constructor(opts: ProgressPrinterOptions) {
    this.color = opts.color;
    this.label = opts.label;
    this.verbose = opts.verbose;
    this.ensureLineBreak = opts.ensureLineBreak;
  }

  update(event: RuntimeProgressEvent): void {
    const signature = [
      event.phase,
      event.summary,
      event.detail ?? "",
      event.transport ?? "",
      event.elapsedMs ?? "",
      event.bytes ?? "",
    ].join("|");

    if (signature === this.lastSignature) {
      return;
    }
    this.lastSignature = signature;

    this.ensureLineBreak?.();

    const meta: string[] = [];
    if (event.transport) meta.push(event.transport);
    if (event.elapsedMs !== undefined) meta.push(formatElapsed(event.elapsedMs));
    if (event.bytes !== undefined) meta.push(formatBytes(event.bytes));

    const suffix = meta.length > 0 ? ` ${dim(`(${meta.join(", ")})`)}` : "";
    console.log(
      `${this.color("  │")}  ${dim(`[${this.label}]`)} ${event.summary}${suffix}`,
    );

    if (this.verbose && event.detail && event.detail !== event.summary) {
      console.log(`${this.color("  │")}  ${dim(event.detail)}`);
    }
  }
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const remainSec = Math.floor(sec % 60);
  return `${min}m${remainSec}s`;
}
