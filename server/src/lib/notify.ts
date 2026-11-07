import { config } from "../config.js";
import type { Appointment, Lead } from "../db/schema.js";
import { getSettings } from "./settings.js";
import { formatIstDateTime } from "./time.js";

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/** Fire-and-forget: delivery failures are logged, never block a call. */
function background(label: string, task: () => Promise<void>) {
  task().catch((err) => console.warn(`[notify] ${label} failed:`, (err as Error).message));
}

async function sendWhatsAppTemplate(to: string, template: string | undefined, params: string[]) {
  if (!config.WHATSAPP_TOKEN || !config.WHATSAPP_PHONE_NUMBER_ID || !template) {
    console.info(`[notify] WhatsApp not configured; would send "${template}" to ${to}:`, params);
    return;
  }
  await postJson(
    `https://graph.facebook.com/v21.0/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to: to.replace(/^\+/, ""),
      type: "template",
      template: {
        name: template,
        language: { code: config.WHATSAPP_TEMPLATE_LANG },
        components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: text || "-" })) }],
      },
    },
    { authorization: `Bearer ${config.WHATSAPP_TOKEN}` },
  );
}

function leadPayload(lead: Lead) {
  return {
    phone: lead.phone,
    name: lead.name,
    city: lead.city,
    concern: lead.concern,
    hairLossDuration: lead.hairLossDuration,
    treatmentInterest: lead.treatmentInterest,
    hairLossStage: lead.hairLossStage,
    budget: lead.budget,
    source: lead.source ?? "Phone (AI receptionist)",
    status: lead.status,
  };
}

/** A new or updated lead from a call: alert the counsellor and push to Clinic OS / Sheet. */
export async function notifyLead(lead: Lead, summary: string) {
  const s = await getSettings();
  if (s.delivery.whatsapp && config.COUNSELLOR_WHATSAPP) {
    background("lead alert", () =>
      sendWhatsAppTemplate(config.COUNSELLOR_WHATSAPP!, config.WHATSAPP_TPL_LEAD_ALERT, [
        lead.name ?? "Unknown caller",
        lead.phone,
        summary.slice(0, 900),
      ]),
    );
  }
  if (s.delivery.clinicOs && config.CLINIC_OS_WEBHOOK_URL) {
    background("Clinic OS lead", () =>
      postJson(
        config.CLINIC_OS_WEBHOOK_URL!,
        { event: "lead.upserted", lead: leadPayload(lead), summary },
        config.CLINIC_OS_WEBHOOK_TOKEN ? { authorization: `Bearer ${config.CLINIC_OS_WEBHOOK_TOKEN}` } : {},
      ),
    );
  }
  if (s.delivery.sheet && config.GOOGLE_SHEET_WEBHOOK_URL) {
    background("Google Sheet", () =>
      postJson(config.GOOGLE_SHEET_WEBHOOK_URL!, { ...leadPayload(lead), summary, at: new Date().toISOString() }),
    );
  }
}

/** A consultation was booked: confirm to the caller and tell Clinic OS. */
export async function notifyBooking(lead: Lead, appt: Appointment) {
  const s = await getSettings();
  const when = formatIstDateTime(appt.startsAt);
  if (s.delivery.whatsapp) {
    background("booking confirmation", () =>
      sendWhatsAppTemplate(lead.phone, config.WHATSAPP_TPL_BOOKING, [lead.name ?? "", when, appt.doctorName]),
    );
  }
  if (s.delivery.clinicOs && config.CLINIC_OS_WEBHOOK_URL) {
    background("Clinic OS appointment", () =>
      postJson(
        config.CLINIC_OS_WEBHOOK_URL!,
        {
          event: "appointment.booked",
          lead: leadPayload(lead),
          appointment: {
            id: appt.id,
            startsAt: appt.startsAt.toISOString(),
            durationMins: appt.durationMins,
            doctorName: appt.doctorName,
            purpose: appt.purpose,
          },
        },
        config.CLINIC_OS_WEBHOOK_TOKEN ? { authorization: `Bearer ${config.CLINIC_OS_WEBHOOK_TOKEN}` } : {},
      ),
    );
  }
}

export async function sendReminder(lead: Lead, appt: Appointment) {
  await sendWhatsAppTemplate(lead.phone, config.WHATSAPP_TPL_REMINDER, [lead.name ?? "", formatIstDateTime(appt.startsAt)]);
}
