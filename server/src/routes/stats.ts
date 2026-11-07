import { and, count, eq, gte, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { callbacks, calls, unansweredQuestions } from "../db/schema.js";
import { requireAuth } from "../lib/auth.js";
import { addDays, fromIst, istDate } from "../lib/time.js";

export const statsRouter = Router();
statsRouter.use(requireAuth);

export function rangeStart(range: "today" | "7d" | "30d", now = new Date()): Date {
  const today = istDate(now);
  if (range === "7d") return fromIst(addDays(today, -6));
  if (range === "30d") return fromIst(addDays(today, -29));
  return fromIst(today);
}

statsRouter.get("/", async (req, res) => {
  const { range } = z.object({ range: z.enum(["today", "7d", "30d"]).default("today") }).parse(req.query);
  const since = rangeStart(range);
  const inRange = gte(calls.startedAt, since);

  const [totals] = await db
    .select({
      calls: count(),
      booked: sql<number>`count(*) filter (where ${calls.outcome} = 'booked')`.mapWith(Number),
      qualified: sql<number>`count(*) filter (where ${calls.outcome} in ('booked','lead_qualified'))`.mapWith(Number),
      handedToStaff: sql<number>`count(*) filter (where ${calls.outcome} in ('transferred','callback_requested'))`.mapWith(Number),
      avgDurationSecs: sql<number>`coalesce(round(avg(${calls.durationSecs})), 0)`.mapWith(Number),
    })
    .from(calls)
    .where(inRange);

  const languages = await db
    .select({ language: calls.language, n: count() })
    .from(calls)
    .where(inRange)
    .groupBy(calls.language);

  const intents = await db
    .select({ intent: calls.intent, n: count() })
    .from(calls)
    .where(and(inRange, sql`${calls.intent} is not null`))
    .groupBy(calls.intent)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  const [pendingCallbacks] = await db.select({ n: count() }).from(callbacks).where(eq(callbacks.status, "pending"));
  const [unanswered] = await db
    .select({ n: count() })
    .from(unansweredQuestions)
    .where(eq(unansweredQuestions.resolved, false));

  res.json({
    range,
    since: since.toISOString(),
    calls: totals.calls,
    qualifiedLeads: totals.qualified,
    booked: totals.booked,
    handedToStaff: totals.handedToStaff,
    avgDurationSecs: totals.avgDurationSecs,
    pendingCallbacks: pendingCallbacks.n,
    unansweredQuestions: unanswered.n,
    languages: languages.map((l) => ({ language: l.language ?? "Unknown", count: l.n })),
    topIntents: intents.map((i) => ({ intent: i.intent!, count: i.n })),
  });
});
