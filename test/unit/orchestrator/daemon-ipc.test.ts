import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { OrchestratorDaemon } from "../../../src/orchestrator/daemon.js";
import type { IpcRequest } from "../../../src/orchestrator/ipc-server.js";

// Mock isProcessAlive so PID checks don't interfere
vi.mock("../../../src/utils/process.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/utils/process.js")>();
  return {
    ...actual,
    isProcessAlive: vi.fn(() => false),
  };
});

describe("OrchestratorDaemon IPC handler", () => {
  let tmpDir: string;
  let daemon: OrchestratorDaemon;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "loop-daemon-ipc-test-"));
    daemon = new OrchestratorDaemon(tmpDir);
    // Initialize the event bus so handleRequest can use it
    await daemon.getEventBus().init();
  });

  afterEach(async () => {
    await daemon.getEventBus().shutdown();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Not-implemented commands return success: false ────
  describe("not-implemented commands", () => {
    const notImplementedTypes = [
      "LAUNCH_AGENT",
      "RESUME_AGENTS",
      "LAUNCH_GROUP",
      "STOP_GROUP",
    ] as const;

    for (const type of notImplementedTypes) {
      it(`${type} returns success: false with "Not implemented"`, async () => {
        const req: IpcRequest = { type, data: {} };
        const res = await daemon.handleRequest(req);
        expect(res.success).toBe(false);
        expect(res.type).toBe(type);
        expect(res.error).toBe("Not implemented");
      });
    }
  });

  // ── STATUS returns valid data ─────────────────────────
  describe("STATUS", () => {
    it("returns success with status data", async () => {
      const req: IpcRequest = { type: "STATUS", data: {} };
      const res = await daemon.handleRequest(req);
      expect(res.success).toBe(true);
      expect(res.type).toBe("STATUS");
      expect(res.data).toBeDefined();
      expect(typeof res.data!.pid).toBe("number");
      expect(typeof res.data!.uptime).toBe("number");
      expect(typeof res.data!.agents).toBe("number");
      expect(typeof res.data!.busEvents).toBe("number");
      expect(Array.isArray(res.data!.agentList)).toBe(true);
    });
  });

  // ── REGISTER_AGENT returns subscriber_id ──────────────
  describe("REGISTER_AGENT", () => {
    it("returns subscriber_id with proper data", async () => {
      const req: IpcRequest = {
        type: "REGISTER_AGENT",
        data: {
          agent_type: "claude",
          nickname: "test-agent",
        },
      };
      const res = await daemon.handleRequest(req);
      expect(res.success).toBe(true);
      expect(res.type).toBe("REGISTER_AGENT");
      expect(res.data).toBeDefined();
      expect(typeof res.data!.subscriber_id).toBe("string");
      expect((res.data!.subscriber_id as string).length).toBeGreaterThan(0);
    });

    it("defaults agent_type to claude when not specified", async () => {
      const req: IpcRequest = {
        type: "REGISTER_AGENT",
        data: {},
      };
      const res = await daemon.handleRequest(req);
      expect(res.success).toBe(true);
      expect(res.data!.subscriber_id).toMatch(/^claude:/);
    });
  });

  // ── Unknown request type returns error ────────────────
  describe("unknown request type", () => {
    it("returns success: false with error for unknown type", async () => {
      const req = { type: "NONEXISTENT_COMMAND", data: {} } as unknown as IpcRequest;
      const res = await daemon.handleRequest(req);
      expect(res.success).toBe(false);
      expect(res.type).toBe("ERROR");
      expect(res.error).toContain("Unknown request type");
      expect(res.error).toContain("NONEXISTENT_COMMAND");
    });
  });

  // ── Invalid request structure ─────────────────────────
  describe("invalid request structure", () => {
    it("returns error for missing type", async () => {
      const req = { data: {} } as unknown as IpcRequest;
      const res = await daemon.handleRequest(req);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid request");
    });

    it("returns error for non-object data", async () => {
      const req = { type: "STATUS", data: "not-an-object" } as unknown as IpcRequest;
      const res = await daemon.handleRequest(req);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid request");
    });
  });
});
