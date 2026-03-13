import { EventEmitter } from "node:events";
import { describe, it, expect, vi, afterEach } from "vitest";

function createMockProcess(stdoutText = ""): EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
} {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();

  queueMicrotask(() => {
    if (stdoutText) {
      proc.stdout.emit("data", Buffer.from(stdoutText));
    }
    proc.emit("close", 0);
  });

  return proc;
}

describe("engine transport selection", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unmock("node:child_process");
    vi.unmock("../../../src/core/runtime.js");
    vi.unmock("../../../src/agent/pty-session.js");
  });

  it("routes Claude through the TTY capture transport", async () => {
    const spawn = vi.fn(() => createMockProcess());
    const runClaudeTtyCapture = vi.fn().mockResolvedValue("OK");

    vi.doMock("node:child_process", () => ({
      spawn,
      execFileSync: vi.fn(() => "claude-version"),
    }));
    vi.doMock("../../../src/core/runtime.js", () => ({
      runClaudeTtyCapture,
      runGeminiTtyCapture: vi.fn(),
      supportsTtyCapturedExecution: vi.fn(() => true),
    }));
    vi.doMock("../../../src/agent/pty-session.js", () => ({
      createPtySession: vi.fn(),
    }));

    const { createEngine } = await import("../../../src/core/engine.js");
    const engine = createEngine("claude");
    const result = await engine.run("Reply with OK", { cwd: "/tmp/test" });

    expect(result).toBe("OK");
    expect(runClaudeTtyCapture).toHaveBeenCalledWith("Reply with OK", { cwd: "/tmp/test" });
    expect(spawn).not.toHaveBeenCalled();
  });

  it("routes Gemini through the TTY capture transport", async () => {
    const spawn = vi.fn(() => createMockProcess());
    const runGeminiTtyCapture = vi.fn().mockResolvedValue("OK");

    vi.doMock("node:child_process", () => ({
      spawn,
      execFileSync: vi.fn(() => "gemini-version"),
    }));
    vi.doMock("../../../src/core/runtime.js", () => ({
      runClaudeTtyCapture: vi.fn(),
      runGeminiTtyCapture,
      supportsTtyCapturedExecution: vi.fn(() => true),
    }));
    vi.doMock("../../../src/agent/pty-session.js", () => ({
      createPtySession: vi.fn(),
    }));

    const { createEngine } = await import("../../../src/core/engine.js");
    const engine = createEngine("gemini");
    const result = await engine.run("Reply with OK", { cwd: "/tmp/test" });

    expect(result).toBe("OK");
    expect(runGeminiTtyCapture).toHaveBeenCalledWith("Reply with OK", { cwd: "/tmp/test" });
    expect(spawn).not.toHaveBeenCalled();
  });

  it("keeps Codex on the direct pipe transport", async () => {
    const spawn = vi.fn(() => createMockProcess("OK\n"));
    const onProgress = vi.fn();

    vi.doMock("node:child_process", () => ({
      spawn,
      execFileSync: vi.fn(() => "codex-version"),
    }));
    vi.doMock("../../../src/core/runtime.js", () => ({
      runClaudeTtyCapture: vi.fn(),
      runGeminiTtyCapture: vi.fn(),
      supportsTtyCapturedExecution: vi.fn(() => true),
    }));
    vi.doMock("../../../src/agent/pty-session.js", () => ({
      createPtySession: vi.fn(),
    }));

    const { createEngine } = await import("../../../src/core/engine.js");
    const engine = createEngine("codex");
    const result = await engine.run("Reply with OK", { cwd: "/tmp/test", onProgress });

    expect(result).toBe("OK");
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn.mock.calls[0]?.[0]).toBe("codex");
    expect(spawn.mock.calls[0]?.[1]).toEqual([
      "exec",
      "--full-auto",
      "--skip-git-repo-check",
      "-C",
      "/tmp/test",
      "Reply with OK",
    ]);
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "transport",
        transport: "pipe",
      }),
    );
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "complete",
        transport: "pipe",
      }),
    );
  });

  it("fails fast for Claude when no controlling TTY is available", async () => {
    vi.doMock("node:child_process", () => ({
      spawn: vi.fn(() => createMockProcess()),
      execFileSync: vi.fn(() => "claude-version"),
    }));
    vi.doMock("../../../src/core/runtime.js", () => ({
      runClaudeTtyCapture: vi.fn(),
      runGeminiTtyCapture: vi.fn(),
      supportsTtyCapturedExecution: vi.fn(() => false),
    }));
    vi.doMock("../../../src/agent/pty-session.js", () => ({
      createPtySession: vi.fn(),
    }));

    const { createEngine } = await import("../../../src/core/engine.js");
    const engine = createEngine("claude");

    await expect(engine.run("Reply with OK", { cwd: "/tmp/test" })).rejects.toThrow(
      "requires an interactive terminal",
    );
  });
});
