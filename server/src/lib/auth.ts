import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { HttpError } from "./http.js";

export type Role = "admin" | "front_desk" | "counsellor";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, config.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthUser {
  const payload = jwt.verify(token, config.JWT_SECRET) as AuthUser & { iat: number; exp: number };
  return { id: payload.id, name: payload.name, email: payload.email, role: payload.role };
}

function tokenFrom(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  // Only for <audio src> which can't send headers.
  if (typeof req.query.token === "string") return req.query.token;
  return undefined;
}

export const requireAuth: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const token = tokenFrom(req);
  if (!token) return next(new HttpError(401, "Please sign in"));
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(new HttpError(401, "Your session has expired, please sign in again"));
  }
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, "Please sign in"));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "You don't have access to this"));
    next();
  };
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** The ElevenLabs agent authenticates its tool calls with a shared secret header. */
export const requireAgentSecret: RequestHandler = (req, _res, next) => {
  const sent = req.header("x-agent-secret") ?? "";
  if (!safeEqual(sent, config.AGENT_TOOL_SECRET)) return next(new HttpError(401, "Invalid agent secret"));
  next();
};
