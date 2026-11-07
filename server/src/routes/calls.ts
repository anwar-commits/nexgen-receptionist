import { Readable } from "node:stream";
import { and, asc, count, desc, eq, gte, ilike, or, type SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { appointments, calls, leads, transcriptTurns } from "../db/schema.js";
import { requireAuth } from "../lib/auth.js";
import {
  elevenlabsConfigured,
  fetchConversationAudio,
  getConversation,
  listConversations,
} from "../lib/elevenlabs.js";
import { notFound, param } from "../lib/http.js";
import { maskPhone, normalizePhone } from "../lib/phone.js";
import { broadcast } from "../lib/realtime.js";
import { rangeStart } from "./stats.js";

export const callsRouter = Router();
callsRouter.use(requireAuth);

const listSchema = z.object({
  range: z.enum(["today", "7d", "30d", "all"]).default("all"),
  outcome: z.enum(["booked", "lead_qualified", "transferred", "callback_requested", "answered", "no_engagement"]).optional(),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

callsRouter.get("/", async (req, res) => {
  const f = listSchema.parse(req.query);
  const where: SQL[] = [];
  if (f.range !== "all") where.push(gte(calls.startedAt, rangeStart(f.range)));
  if (f.outcome) where.push(eq(calls.outcome, f.outcome));
  if (f.q) {
    const like = `%${f.q}%`;
    where.push(or(ilike(calls.callerName, like), ilike(calls.callerPhone, like), ilike(calls.city, like))!);
  }
  const cond = where.length ? and(...where) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(calls)
      .where(cond)
      .orderBy(desc(calls.startedAt))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize),
    db.select({ total: count() }).from(calls).where(cond),
  ]);
  res.json({ calls: rows, total, page: f.page, pageSize: f.pageSize });
});

/** Calls happening right now, read straight from ElevenLabs (polled by the apps). */
callsRouter.get("/live", async (_req, res) => {
  if (!elevenlabsConfigured()) {
    res.json({ live: [], configured: false });
    return;
  }
  const { conversations } = await listConversations(20);
  const active = conversations.filter((c) => c.status === "in-progress" || c.status === "initiated").slice(0, 3);
  const live = await Promise.all(
    active.map(async (c) => {
      const detail = await getConversation(c.conversation_id).catch(() => null);
      const phone = normalizePhone(
        detail?.metadata?.phone_call?.external_number ??
          (detail?.conversation_initiation_client_data?.dynamic_variables?.system__caller_id as string | undefined),
      );
      const turns = (detail?.transcript ?? []).filter((t) => t.message).slice(-4);
      return {
        conversationId: c.conversation_id,
        callerPhone: phone,
        callerLabel: maskPhone(phone),
        startedAt: new Date(c.start_time_unix_secs * 1000).toISOString(),
        recentTurns: turns.map((t) => ({ role: t.role === "agent" ? "agent" : "user", message: t.message })),
      };
    }),
  );
  res.json({ live, configured: true });
});

callsRouter.get("/:id", async (req, res) => {
  const id = param(req.params.id);
  const call = await db.query.calls.findFirst({ where: eq(calls.id, id) });
  if (!call) throw notFound("Call");
  const [turns, lead, appts] = await Promise.all([
    db.select().from(transcriptTurns).where(eq(transcriptTurns.callId, id)).orderBy(asc(transcriptTurns.position)),
    call.leadId ? db.query.leads.findFirst({ where: eq(leads.id, call.leadId) }) : Promise.resolve(undefined),
    call.leadId
      ? db.select().from(appointments).where(eq(appointments.leadId, call.leadId)).orderBy(desc(appointments.startsAt))
      : Promise.resolve([]),
  ]);
  res.json({ call, transcript: turns, lead: lead ?? null, appointments: appts });
});

callsRouter.patch("/:id", async (req, res) => {
  const body = z.object({ staffNotes: z.string().max(5000).nullable() }).parse(req.body);
  const [call] = await db
    .update(calls)
    .set({ staffNotes: body.staffNotes, updatedAt: new Date() })
    .where(eq(calls.id, param(req.params.id)))
    .returning();
  if (!call) throw notFound("Call");
  broadcast("call:updated", { id: call.id });
  res.json({ call });
});

/** Streams the call recording from ElevenLabs. Accepts ?token= so <audio src> works. */
callsRouter.get("/:id/audio", async (req, res) => {
  const call = await db.query.calls.findFirst({ where: eq(calls.id, param(req.params.id)) });
  if (!call) throw notFound("Call");
  const upstream = await fetchConversationAudio(call.conversationId);
  res.setHeader("content-type", upstream.headers.get("content-type") ?? "audio/mpeg");
  const len = upstream.headers.get("content-length");
  if (len) res.setHeader("content-length", len);
  res.setHeader("cache-control", "private, max-age=3600");
  Readable.fromWeb(upstream.body as import("node:stream/web").ReadableStream).pipe(res);
});
