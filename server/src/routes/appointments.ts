import { and, asc, eq, gte, lt, type SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { appointments, leads } from "../db/schema.js";
import { requireAuth } from "../lib/auth.js";
import { HttpError, notFound, param } from "../lib/http.js";
import { normalizePhone } from "../lib/phone.js";
import { broadcast } from "../lib/realtime.js";
import { getSettings } from "../lib/settings.js";
import { addDays, fromIst, istDate } from "../lib/time.js";
import { assertSlotFree, freeSlots } from "../services/booking.js";
import { createBooking } from "../services/appointments.js";

export const appointmentsRouter = Router();
appointmentsRouter.use(requireAuth);

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

appointmentsRouter.get("/", async (req, res) => {
  const f = z
    .object({
      from: dateStr.optional(),
      days: z.coerce.number().int().min(1).max(90).default(14),
      status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).optional(),
    })
    .parse(req.query);
  const from = f.from ?? istDate(new Date());
  const where: SQL[] = [gte(appointments.startsAt, fromIst(from)), lt(appointments.startsAt, fromIst(addDays(from, f.days)))];
  if (f.status) where.push(eq(appointments.status, f.status));
  const rows = await db
    .select({ appointment: appointments, lead: { id: leads.id, name: leads.name, phone: leads.phone, city: leads.city } })
    .from(appointments)
    .innerJoin(leads, eq(appointments.leadId, leads.id))
    .where(and(...where))
    .orderBy(asc(appointments.startsAt));
  res.json({ appointments: rows.map((r) => ({ ...r.appointment, lead: r.lead })) });
});

appointmentsRouter.get("/availability", async (req, res) => {
  const { date } = z.object({ date: dateStr }).parse(req.query);
  res.json({ date, slots: await freeSlots(date, await getSettings()) });
});

const createSchema = z.object({
  phone: z.string().min(6),
  name: z.string().optional(),
  date: dateStr,
  time: timeStr,
  purpose: z.string().optional(),
});

appointmentsRouter.post("/", async (req, res) => {
  const body = createSchema.parse(req.body);
  const phone = normalizePhone(body.phone);
  if (!phone) throw new HttpError(400, "Enter a valid phone number");
  const result = await createBooking({
    phone,
    date: body.date,
    time: body.time,
    purpose: body.purpose,
    bookedBy: "staff",
    lead: { name: body.name },
  });
  res.status(201).json(result);
});

const updateSchema = z.object({
  status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).optional(),
  date: dateStr.optional(),
  time: timeStr.optional(),
});

appointmentsRouter.patch("/:id", async (req, res) => {
  const id = param(req.params.id);
  const body = updateSchema.parse(req.body);
  const existing = await db.query.appointments.findFirst({ where: eq(appointments.id, id) });
  if (!existing) throw notFound("Appointment");

  const patch: Partial<typeof appointments.$inferInsert> = { updatedAt: new Date() };
  if (body.status) patch.status = body.status;
  if (body.date && body.time) {
    // Free the current slot first so moving within the same day works.
    await db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, id));
    try {
      await assertSlotFree(body.date, body.time, await getSettings());
    } catch (err) {
      await db.update(appointments).set({ status: existing.status }).where(eq(appointments.id, id));
      throw err;
    }
    patch.startsAt = fromIst(body.date, body.time);
    patch.status = body.status ?? "scheduled";
    patch.reminderSentAt = null;
  }
  const [appointment] = await db.update(appointments).set(patch).where(eq(appointments.id, id)).returning();

  if (appointment.status === "completed") {
    await db.update(leads).set({ status: "converted", updatedAt: new Date() }).where(eq(leads.id, appointment.leadId));
    broadcast("lead:updated", { id: appointment.leadId });
  }
  broadcast("appointment:updated", { id });
  res.json({ appointment });
});
