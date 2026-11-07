import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { appointments, leads } from "../db/schema.js";
import { sendReminder } from "../lib/notify.js";
import { getSettings } from "../lib/settings.js";
import { addDays, fromIst, istDate, istParts } from "../lib/time.js";

/** From 6 PM IST, send WhatsApp reminders for tomorrow's consultations (once each). */
export async function sendDueReminders(now = new Date()) {
  const s = await getSettings();
  if (!s.booking.reminderEveningBefore || !s.delivery.whatsapp) return;
  if (istParts(now).hour < 18) return;

  const tomorrow = addDays(istDate(now), 1);
  const due = await db
    .select({ appt: appointments, lead: leads })
    .from(appointments)
    .innerJoin(leads, eq(appointments.leadId, leads.id))
    .where(
      and(
        eq(appointments.status, "scheduled"),
        isNull(appointments.reminderSentAt),
        gte(appointments.startsAt, fromIst(tomorrow)),
        lt(appointments.startsAt, fromIst(addDays(tomorrow, 1))),
      ),
    );

  for (const { appt, lead } of due) {
    try {
      await sendReminder(lead, appt);
      await db.update(appointments).set({ reminderSentAt: new Date() }).where(eq(appointments.id, appt.id));
    } catch (err) {
      console.warn(`[reminders] ${appt.id} failed:`, (err as Error).message);
    }
  }
}

export function startReminderJob() {
  const run = () => sendDueReminders().catch((err) => console.warn("[reminders]", (err as Error).message));
  setInterval(run, 10 * 60 * 1000).unref();
  run();
}
