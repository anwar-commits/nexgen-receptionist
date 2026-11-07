import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { leads, type Lead } from "../db/schema.js";
import { broadcast } from "../lib/realtime.js";

export interface LeadFields {
  name?: string | null;
  city?: string | null;
  concern?: string | null;
  hairLossDuration?: string | null;
  treatmentInterest?: string | null;
  hairLossStage?: string | null;
  budget?: string | null;
  source?: string | null;
}

const STATUS_RANK: Record<Lead["status"], number> = { new: 0, qualified: 1, booked: 2, converted: 3, lost: -1 };

const clean = (v: string | null | undefined) => {
  const t = v?.trim();
  return t ? t : undefined;
};

/**
 * Create the lead for a phone number, or fill in what we've newly learned.
 * New non-empty values win; existing values are kept when the caller didn't repeat them.
 * Status only moves forward (new → qualified → booked), never backwards.
 */
export async function upsertLead(phone: string, fields: LeadFields, status?: Lead["status"]): Promise<Lead> {
  const values: Partial<typeof leads.$inferInsert> = {};
  for (const [k, v] of Object.entries(fields)) {
    const c = clean(v as string | null | undefined);
    if (c) (values as Record<string, string>)[k] = c;
  }

  const existing = await db.query.leads.findFirst({ where: eq(leads.phone, phone) });
  let lead: Lead;
  if (!existing) {
    const inferred = status ?? (values.name || values.concern ? "qualified" : "new");
    [lead] = await db.insert(leads).values({ phone, ...values, status: inferred }).returning();
  } else {
    const nextStatus =
      status && STATUS_RANK[status] > STATUS_RANK[existing.status] && existing.status !== "lost"
        ? status
        : existing.status === "new" && (values.name || values.concern)
          ? "qualified"
          : existing.status;
    [lead] = await db
      .update(leads)
      .set({ ...values, status: nextStatus, updatedAt: sql`now()` })
      .where(eq(leads.id, existing.id))
      .returning();
  }
  broadcast("lead:updated", { id: lead.id });
  return lead;
}

export function leadSummary(lead: Lead): string {
  return [
    lead.concern && `Concern: ${lead.concern}`,
    lead.hairLossDuration && `For: ${lead.hairLossDuration}`,
    lead.treatmentInterest && `Interested in: ${lead.treatmentInterest}`,
    lead.city && `City: ${lead.city}`,
    lead.budget && `Budget: ${lead.budget}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
