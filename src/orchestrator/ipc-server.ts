import { createServer, type Server, type Socket } from "node:net";
import { unlinkSync } from "node:fs";

/**
 * Request types the IPC server handles.
 */
export type IpcRequestType =
  | "REGISTER_AGENT"
  | "AGENT_READY"
  | "AGENT_REPORT"
  | "LAUNCH_AGENT"
  | "CLOSE_AGENT"
  | "RESUME_AGENTS"
  | "STATUS"
  | "BUS_SEND"
  | "BUS_CHECK"
  | "LAUNCH_GROUP"
  | "STOP_GROUP";

/**
 * Incoming IPC request.
 */
export interface IpcRequest {
  type: IpcRequestType;
  data: Record<string, unknown>;
}

/**
 * Outgoing IPC response.
 */
export interface IpcResponse {
  success: boolean;
  type: string;
  data?: Record<string, unknown>;
  error?: string;
}

/** Handler function signature for processing requests. */
export type IpcRequestHandler = (req: IpcRequest) => Promise<IpcResponse>;

/**
 * Unix domain socket IPC server.
 *
 * Protocol: newline-delimited JSON (each message is a JSON object
 * followed by a newline character).
 */
export class IpcServer {
  private readonly socketPath: string;
  private readonly handler: IpcRequestHandler;
  private server: Server | null = null;
  private sockets: Set<Socket> = new Set();

  constructor(socketPath: string, handler: IpcRequestHandler) {
    this.socketPath = socketPath;
    this.handler = handler;
  }

  /**
   * Start listening on the Unix socket.
   */
  async start(): Promise<void> {
    // Remove stale socket file if it exists
    try {
      unlinkSync(this.socketPath);
    } catch {
      // Ignore - file may not exist
    }

    return new Promise<void>((resolve, reject) => {
      this.server = createServer((socket) => this.handleConnection(socket));

      this.server.on("error", (err) => {
        reject(err);
      });

      this.server.listen(this.socketPath, () => {
        resolve();
      });
    });
  }

  /**
   * Stop the IPC server and close all connections.
   */
  async stop(): Promise<void> {
    // Close all client sockets
    for (const socket of this.sockets) {
      try {
        socket.destroy();
      } catch {
        // Ignore
      }
    }
    this.sockets.clear();

    // Close the server
    if (this.server) {
      return new Promise<void>((resolve) => {
        this.server!.close(() => {
          // Remove socket file
          try {
            unlinkSync(this.socketPath);
          } catch {
            // Ignore
          }
          resolve();
        });
      });
    }

    // Remove socket file even if server wasn't created
    try {
      unlinkSync(this.socketPath);
    } catch {
      // Ignore
    }
  }

  /**
   * Send a message to all connected clients.
   */
  broadcast(payload: IpcResponse): void {
    const line = JSON.stringify(payload) + "\n";
    for (const socket of this.sockets) {
      if (socket.destroyed) continue;
      try {
        socket.write(line);
      } catch {
        // Ignore write errors
      }
    }
  }

  /**
   * Get the number of connected clients.
   */
  get clientCount(): number {
    return this.sockets.size;
  }

  /**
   * Handle a new socket connection.
   */
  private handleConnection(socket: Socket): void {
    this.sockets.add(socket);

    let buffer = "";

    socket.on("data", (data) => {
      buffer += data.toString("utf8");

      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep incomplete last line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        this.processLine(trimmed, socket).catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          const errorResponse: IpcResponse = {
            success: false,
            type: "ERROR",
            error: message,
          };
          try {
            socket.write(JSON.stringify(errorResponse) + "\n");
          } catch {
            // Ignore write errors
          }
        });
      }
    });

    socket.on("close", () => {
      this.sockets.delete(socket);
    });

    socket.on("error", () => {
      this.sockets.delete(socket);
    });
  }

  /**
   * Process a single JSON line from a client.
   */
  private async processLine(line: string, socket: Socket): Promise<void> {
    let req: IpcRequest;
    try {
      req = JSON.parse(line) as IpcRequest;
    } catch {
      const errorResponse: IpcResponse = {
        success: false,
        type: "ERROR",
        error: "Invalid JSON",
      };
      socket.write(JSON.stringify(errorResponse) + "\n");
      return;
    }

    if (!req || typeof req !== "object" || !req.type) {
      const errorResponse: IpcResponse = {
        success: false,
        type: "ERROR",
        error: "Missing request type",
      };
      socket.write(JSON.stringify(errorResponse) + "\n");
      return;
    }

    const response = await this.handler(req);
    socket.write(JSON.stringify(response) + "\n");
  }
}
