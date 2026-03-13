import { describe, it, expect, vi, afterEach } from "vitest";

describe("conversation PTY fallback", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unmock("../../../src/core/runtime.js");
  });

  it("skips interactive PTY when the health probe fails", async () => {
    vi.doMock("../../../src/core/runtime.js", () => ({
      isPtyHealthy: vi.fn(() => false),
    }));

    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { runConversation } = await import("../../../src/core/conversation.js");

    const interactive = vi.fn(() => {
      throw new Error("interactive should not run");
    });
    const run = vi.fn(async (_prompt: string, options: { onData?: (chunk: string) => void }) => {
      options.onData?.("OK");
      return "OK";
    });

    const result = await runConversation({
      engine: {
        name: "claude",
        label: "Claude",
        color: (s: string) => s,
        checkVersion: () => "mock",
        run,
        interactive,
      },
      initialPrompt: "Reply with OK",
      cwd: "/tmp/test",
      verbose: false,
      mode: { current: "auto" },
    });

    expect(interactive).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.finalOutput).toBe("OK");

    stdoutSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("shows the manual follow-up boundary after executor completion", async () => {
    vi.doMock("../../../src/core/runtime.js", () => ({
      isPtyHealthy: vi.fn(() => false),
    }));
    vi.doMock("node:readline", () => ({
      createInterface: vi.fn(() => ({
        question: (_prompt: string, cb: (answer: string) => void) => cb(""),
        close: vi.fn(),
        on: vi.fn(),
      })),
    }));

    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { runConversation } = await import("../../../src/core/conversation.js");

    const run = vi.fn(async (_prompt: string, options: { onData?: (chunk: string) => void }) => {
      options.onData?.("OK\n");
      return "OK";
    });

    await runConversation({
      engine: {
        name: "claude",
        label: "Claude",
        color: (s: string) => s,
        checkVersion: () => "mock",
        run,
        interactive: vi.fn(() => {
          throw new Error("interactive should not run");
        }),
      },
      initialPrompt: "Reply with OK",
      cwd: "/tmp/test",
      verbose: false,
      mode: { current: "manual" },
    });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Awaiting follow-up or submit."));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Submitting current result for review."));

    stdoutSpy.mockRestore();
    logSpy.mockRestore();
  });
});
