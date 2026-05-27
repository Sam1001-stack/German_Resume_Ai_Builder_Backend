import type { Server as HttpServer } from "http";
import { Server } from "socket.io";

let io: Server | null = null;

export function initRecruiterSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"],
    },
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    socket.on("join-job", (jobId: string) => {
      if (typeof jobId === "string" && jobId) {
        socket.join(`job:${jobId}`);
      }
    });
    socket.on("leave-job", (jobId: string) => {
      if (typeof jobId === "string" && jobId) {
        socket.leave(`job:${jobId}`);
      }
    });
  });

  return io;
}

export function getRecruiterIO(): Server | null {
  return io;
}

export function emitScanProgress(
  jobId: string,
  payload: {
    status: string;
    total: number;
    processed: number;
    failed: number;
    message?: string;
    currentFile?: string;
  }
): void {
  io?.to(`job:${jobId}`).emit("scan:progress", payload);
}

export function emitScanComplete(
  jobId: string,
  payload: { topCount: number; message?: string }
): void {
  io?.to(`job:${jobId}`).emit("scan:complete", payload);
}

export function emitScanError(jobId: string, message: string): void {
  io?.to(`job:${jobId}`).emit("scan:error", { message });
}
