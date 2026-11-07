import { db } from "../db/index.js";
import { appointments, type Appointment, type Lead } from "../db/schema.js";
import { notifyBooking } from "../lib/notify.js";
import { broadcast } from "../lib/realtime.js";
import { getSettings } from "../lib/settings.js";
import { fromIst } from "../lib/time.js";
import { assertSlotFree } from "./booking.js";
import { upsertLead, type LeadFields } from "./leads.js";

export interface BookingInput {
  phone: string;
  date: string; // YYYY-MM-DD (IST)
  time: string; // HH:MM (IST)
  purpose?: string | null;
  bookedBy: "agent" | "staff";
  conversationId?: string | null;
  lead?: LeadFields;
}

/** Book a consultation: checks the slot, creates/updates the lead, and sends confirmations. */
export async function createBooking(input: BookingInput): Promise<{ lead: Lead; appointment: Appointment }> {
  const s = await getSettings();
  await assertSlotFree(input.date, input.time, s);
  const lead = await upsertLead(input.phone, input.lead ?? {}, "booked");
  const [appointment] = await db
    .insert(appointments)
    .values({
      leadId: lead.id,
      doctorName: s.booking.doctorName,
      startsAt: fromIst(input.date, input.time),
      durationMins: s.booking.slotMinutes,
      purpose: input.purpose ?? lead.treatmentInterest ?? "Consultation",
      bookedBy: input.bookedBy,
      conversationId: input.conversationId ?? null,
    })
    .returning();
  broadcast("appointment:updated", { id: appointment.id });
  await notifyBooking(lead, appointment);
  return { lead, appointment };
}
