import { Router, type Request, type Response } from "express";
import { z, ZodError } from "zod";
import { db } from "../db/index.js";
import { callbacks, unansweredQuestions } from "../db/schema.js";
import { requireAgentSecret } from "../lib/auth.js";
import { HttpError } from "../lib/http.js";
import { notifyLead } from "../lib/notify.js";
import { normalizePhone } from "../lib/phone.js";
import { broadcast } from "../lib/realtime.js";
import { getSettings } from "../lib/settings.js";
import { formatIstDay, formatTime12, resolveDay } from "../lib/time.js";
import { createBooking } from "../services/appointments.js";
import { availabilityFor, isOpenOn } from "../services/booking.js";
import { leadSummary, upsertLead } from "../services/leads.js";

/**
 * Endpoints the ElevenLabs agent calls during a live phone call (registered as webhook tools by
 * `npm run elevenlabs:setup`). They always answer 200 with a short `message` the agent can say,
 * so a problem never leaves the caller in silence.
 */
export const agentToolsRouter = Router();
agentToolsRouter.use(requireAgentSecret);

const optStr = z.string().optional().nullable();

function tool<T>(schema: z.ZodType<T>, handler: (body: T) => Promise<Record<string, unknown>>) {
  return async (req: Request, res: Response) => {
    try {
      const body = schema.parse(req.body ?? {});
      res.json({ ok: true, ...(await handler(body)) });
    } catch (err) {
      const message =
        err instanceof ZodError
          ? `Missing or invalid details: ${err.issues.map((i) => i.path.join(".")).join(", ")}`
          : err instanceof HttpError
            ? err.message
            : "Something went wrong on our side";
      if (!(err instanceof ZodError) && !(err instanceof HttpError)) console.error("[agent-tool]", err);
      res.json({ ok: false, message });
    }
  };
}

function phoneOrThrow(raw: string | null | undefined): string {
  const phone = normalizePhone(raw);
  if (!phone) throw new HttpError(400, "The caller's phone number is not available. Ask the caller for their mobile number and pass it as caller_phone.");
  return phone;
}

agentToolsRouter.post(
  "/check_availability",
  tool(z.object({ day: z.string().default("today") }), async ({ day }) => {
    const s = await getSettings();
    const date = resolveDay(day);
    if (!date) return { message: `I couldn't understand the day "${day}". Ask the caller for a day like today, tomorrow, or a weekday.` };
    const days = await availabilityFor(date, s);
    if (!days.length) return { available: false, message: "No free consultation slots in the next 7 days. Offer a callback instead." };
    const first = days[0];
    const requestedClosed = !isOpenOn(date, s);
    const note =
      first.date !== date
        ? `${formatIstDay(date)} is ${requestedClosed ? "a holiday (clinic closed)" : "full"}. Nearest available: ${first.label}.`
        : `Available on ${first.label}.`;
    return {
      available: true,
      requested_date: date,
      options: days,
      message: `${note} Times: ${first.slots_spoken.join(", ")}. Use date "${first.date}" and the 24-hour time (e.g. "${first.slots[0]}") when booking.`,
    };
  }),
);

agentToolsRouter.post(
  "/book_appointment",
  tool(
    z.object({
      caller_phone: optStr,
      conversation_id: optStr,
      name: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      city: optStr,
      concern: optStr,
      treatment_interest: optStr,
    }),
    async (b) => {
      const phone = phoneOrThrow(b.caller_phone);
      const { appointment } = await createBooking({
        phone,
        date: b.date,
        time: b.time,
        bookedBy: "agent",
        conversationId: b.conversation_id ?? null,
        purpose: b.treatment_interest ? `${b.treatment_interest} consultation` : "Consultation",
        lead: { name: b.name, city: b.city, concern: b.concern, treatmentInterest: b.treatment_interest },
      });
      return {
        appointment_id: appointment.id,
        message: `Booked for ${formatIstDay(b.date)} at ${formatTime12(b.time)} with ${appointment.doctorName}. A WhatsApp confirmation will be sent to the caller.`,
      };
    },
  ),
);

agentToolsRouter.post(
  "/save_lead",
  tool(
    z.object({
      caller_phone: optStr,
      name: optStr,
      city: optStr,
      concern: optStr,
      hair_loss_duration: optStr,
      treatment_interest: optStr,
      budget: optStr,
      source: optStr,
    }),
    async (b) => {
      const phone = phoneOrThrow(b.caller_phone);
      const existed = await db.query.leads.findFirst({ where: (l, { eq }) => eq(l.phone, phone) });
      const lead = await upsertLead(phone, {
        name: b.name,
        city: b.city,
        concern: b.concern,
        hairLossDuration: b.hair_loss_duration,
        treatmentInterest: b.treatment_interest,
        budget: b.budget,
        source: b.source,
      });
      if (!existed || existed.status === "new") await notifyLead(lead, leadSummary(lead));
      return { lead_id: lead.id, message: "Saved. A counsellor will follow up." };
    },
  ),
);

agentToolsRouter.post(
  "/request_callback",
  tool(
    z.object({ caller_phone: optStr, conversation_id: optStr, name: optStr, reason: z.string().min(1) }),
    async (b) => {
      const phone = phoneOrThrow(b.caller_phone);
      const [row] = await db
        .insert(callbacks)
        .values({ phone, name: b.name ?? null, reason: b.reason, conversationId: b.conversation_id ?? null })
        .returning();
      broadcast("callback:updated", { id: row.id });
      return { message: "Callback request saved. The front desk will call back soon." };
    },
  ),
);

agentToolsRouter.post(
  "/log_unanswered_question",
  tool(z.object({ question: z.string().min(1), caller_phone: optStr, conversation_id: optStr }), async (b) => {
    await db.insert(unansweredQuestions).values({
      question: b.question,
      callerPhone: normalizePhone(b.caller_phone),
      conversationId: b.conversation_id ?? null,
    });
    return { message: "Noted. Tell the caller the team will get back with the answer." };
  }),
);
