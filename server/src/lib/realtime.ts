import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { corsOrigins } from "../config.js";
import { verifyToken } from "./auth.js";

export type RealtimeEvent =
  | "call:updated"
  | "lead:updated"
  | "appointment:updated"
  | "callback:updated"
  | "settings:updated";

let io: Server | null = null;

export function initRealtime(server: HttpServer) {
  io = new Server(server, { cors: { origin: corsOrigins } });
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string") return next(new Error("unauthorized"));
    try {
      socket.data.user = verifyToken(token);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });
  io.on("connection", (socket) => socket.join("staff"));
}

/** Tell every signed-in app (web and mobile) that something changed. */
export function broadcast(event: RealtimeEvent, payload: Record<string, unknown> = {}) {
  io?.to("staff").emit(event, payload);
}
