import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { appointments, calls, leads } from "../db/schema.js";
import { requireAuth } from "../lib/auth.js";
import { notFound, param } from "../lib/http.js";
import { broadcast } from "../lib/realtime.js";

export const leadsRouter = Router();
leadsRouter.use(requireAuth);

const statusEnum = z.enum(["new", "qualified", "booked", "converted", "lost"]);

leadsRouter.get("/", async (req, res) => {
  const f = z
    .object({
      status: statusEnum.optional(),
      q: z.string().trim().optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
    })
    .parse(req.query);
  const where: SQL[] = [];
  if (f.status) where.push(eq(leads.status, f.status));
  if (f.q) {
    const like = `%${f.q}%`;
    where.push(or(ilike(leads.name, like), ilike(leads.phone, like), ilike(leads.city, like))!);
  }
  const cond = where.length ? and(...where) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(leads).where(cond).orderBy(desc(leads.updatedAt)).limit(f.pageSize).offset((f.page - 1) * f.pageSize),
    db.select({ total: count() }).from(leads).where(cond),
  ]);
  res.json({ leads: rows, total, page: f.page, pageSize: f.pageSize });
});

leadsRouter.get("/:id", async (req, res) => {
  const id = param(req.params.id);
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, id) });
  if (!lead) throw notFound("Lead");
  const [leadCalls, appts] = await Promise.all([
    db.select().from(calls).where(eq(calls.leadId, id)).orderBy(desc(calls.startedAt)),
    db.select().from(appointments).where(eq(appointments.leadId, id)).orderBy(desc(appointments.startsAt)),
  ]);
  res.json({ lead, calls: leadCalls, appointments: appts });
});

const updateSchema = z.object({
  name: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  concern: z.string().nullable().optional(),
  hairLossDuration: z.string().nullable().optional(),
  treatmentInterest: z.string().nullable().optional(),
  hairLossStage: z.string().nullable().optional(),
  budget: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  status: statusEnum.optional(),
  assignedToId: z.uuid().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

leadsRouter.patch("/:id", async (req, res) => {
  const body = updateSchema.parse(req.body);
  const [lead] = await db
    .update(leads)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(leads.id, param(req.params.id)))
    .returning();
  if (!lead) throw notFound("Lead");
  broadcast("lead:updated", { id: lead.id });
  res.json({ lead });
});
