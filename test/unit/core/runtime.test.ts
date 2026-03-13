import { describe, it, expect, vi, afterEach } from "vitest";

describe("runtime helpers", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unmock("node-pty");
  });

  it("parses Claude structured output and ignores non-JSON preamble", async () => {
    const { parseClaudeStructuredOutput } = await import("../../../src/core/runtime.js");
    const onData = vi.fn();
    const onStatus = vi.fn();
    const onProgress = vi.fn();

    const output = parseClaudeStructuredOutput(
      [
        "[WARN] Fast mode is not available in the Agent SDK. Using Opus 4.6.",
        '{"type":"system"}',
        '{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"OK"}}}',
        '{"type":"result","result":"OK"}',
      ].join("\n"),
      { onData, onStatus, onProgress },
    );

    expect(output).toBe("OK");
    expect(onData).toHaveBeenCalledWith("OK");
    expect(onStatus).toHaveBeenCalledWith("session started");
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "status",
        summary: "Session started",
      }),
    );
  });

  it("parses Gemini structured output and ignores credential preamble", async () => {
    const { parseGeminiStructuredOutput } = await import("../../../src/core/runtime.js");
    const onData = vi.fn();
    const onStatus = vi.fn();
    const onProgress = vi.fn();

    const output = parseGeminiStructuredOutput(
      [
        "Loaded cached credentials.",
        '{"type":"init","model":"auto-gemini-3"}',
        '{"type":"message","role":"assistant","content":"OK","delta":true}',
        '{"type":"result","status":"success"}',
      ].join("\n"),
      { onData, onStatus, onProgress },
    );

    expect(output).toBe("OK");
    expect(onData).toHaveBeenCalledWith("OK");
    expect(onStatus).toHaveBeenCalledWith("auto-gemini-3");
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "status",
        summary: "Model: auto-gemini-3",
      }),
    );
  });

  it("caches PTY health probe results", async () => {
    const kill = vi.fn();
    const spawn = vi.fn(() => ({ kill }));

    vi.doMock("node-pty", () => ({
      default: { spawn },
    }));

    const runtime = await import("../../../src/core/runtime.js");
    runtime.resetPtyHealthCacheForTest();

    expect(runtime.isPtyHealthy()).toBe(true);
    expect(runtime.isPtyHealthy()).toBe(true);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(kill).toHaveBeenCalledTimes(1);
  });

  it("reports unhealthy PTY when probe throws", async () => {
    const spawn = vi.fn(() => {
      throw new Error("posix_spawnp failed");
    });

    vi.doMock("node-pty", () => ({
      default: { spawn },
    }));

    const runtime = await import("../../../src/core/runtime.js");
    runtime.resetPtyHealthCacheForTest();

    expect(runtime.isPtyHealthy()).toBe(false);
    expect(runtime.isPtyHealthy()).toBe(false);
    expect(spawn).toHaveBeenCalledTimes(1);
  });
});
