import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { calls, transcriptTurns } from "../db/schema.js";
import { notifyLead } from "../lib/notify.js";
import { normalizePhone } from "../lib/phone.js";
import { broadcast } from "../lib/realtime.js";
import { leadSummary, upsertLead } from "./leads.js";

type Outcome = (typeof calls.$inferInsert)["outcome"];
const OUTCOMES = new Set(["booked", "lead_qualified", "transferred", "callback_requested", "answered", "no_engagement"]);

export interface PostCallData {
  agent_id?: string;
  conversation_id: string;
  status?: string;
  transcript?: { role: string; message: string | null; time_in_call_secs?: number }[];
  metadata?: {
    start_time_unix_secs?: number;
    call_duration_secs?: number;
    phone_call?: { external_number?: string | null } | null;
  };
  analysis?: {
    transcript_summary?: string;
    call_successful?: string;
    evaluation_criteria_results?: Record<string, { result?: string; rationale?: string }>;
    data_collection_results?: Record<string, { value?: unknown }>;
  } | null;
  conversation_initiation_client_data?: { dynamic_variables?: Record<string, unknown> } | null;
}

function dc(data: PostCallData, key: string): string | undefined {
  const v = data.analysis?.data_collection_results?.[key]?.value;
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s && s.toLowerCase() !== "none" && s.toLowerCase() !== "null" ? s : undefined;
}

/** Store a finished call (from the post-call webhook) with its transcript, and update the caller's lead. */
export async function ingestPostCall(data: PostCallData) {
  const phone = normalizePhone(
    data.metadata?.phone_call?.external_number ??
      (data.conversation_initiation_client_data?.dynamic_variables?.system__caller_id as string | undefined),
  );
  const outcomeRaw = dc(data, "outcome");
  const outcome = (outcomeRaw && OUTCOMES.has(outcomeRaw) ? outcomeRaw : null) as Outcome;
  const startedAt = data.metadata?.start_time_unix_secs ? new Date(data.metadata.start_time_unix_secs * 1000) : new Date();

  const fields = {
    name: dc(data, "caller_name"),
    city: dc(data, "city"),
    concern: dc(data, "concern"),
    hairLossDuration: dc(data, "hair_loss_duration"),
    treatmentInterest: dc(data, "treatment_interest"),
    budget: dc(data, "budget"),
    source: dc(data, "source"),
  };

  let leadId: string | null = null;
  const learnedSomething = Object.values(fields).some(Boolean);
  if (phone && (learnedSomething || outcome === "booked" || outcome === "lead_qualified")) {
    const before = await db.query.leads.findFirst({ where: (l, { eq }) => eq(l.phone, phone) });
    const lead = await upsertLead(phone, fields, outcome === "booked" ? "booked" : undefined);
    leadId = lead.id;
    // Alert only for brand-new leads; the save_lead / book_appointment tools already alerted during the call.
    if (!before) await notifyLead(lead, data.analysis?.transcript_summary ?? leadSummary(lead));
  }

  const values = {
    conversationId: data.conversation_id,
    callerPhone: phone,
    callerName: fields.name ?? null,
    city: fields.city ?? null,
    language: dc(data, "language") ?? null,
    intent: dc(data, "intent") ?? null,
    outcome,
    status: data.status === "failed" ? ("failed" as const) : ("ended" as const),
    durationSecs: Math.round(data.metadata?.call_duration_secs ?? 0),
    startedAt,
    summary: data.analysis?.transcript_summary ?? null,
    analysis: data.analysis?.data_collection_results ?? null,
    evaluation: data.analysis?.evaluation_criteria_results ?? null,
    leadId,
    updatedAt: new Date(),
  };

  const call = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(calls)
      .values(values)
      .onConflictDoUpdate({ target: calls.conversationId, set: values })
      .returning();
    await tx.delete(transcriptTurns).where(eq(transcriptTurns.callId, row.id));
    const turns = (data.transcript ?? [])
      .filter((t) => t.message && t.message.trim())
      .map((t, i) => ({
        callId: row.id,
        position: i,
        role: t.role === "agent" ? "agent" : "user",
        message: t.message!.trim(),
        timeSecs: Math.round(t.time_in_call_secs ?? 0),
      }));
    if (turns.length) await tx.insert(transcriptTurns).values(turns);
    return row;
  });

  broadcast("call:updated", { id: call.id });
  return call;
}
