import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { agentSettings } from "../db/schema.js";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");

export const settingsSchema = z.object({
  clinicName: z.string().min(1).default("NexGen Hair Transplant"),
  clinicCity: z.string().min(1).default("Patna"),
  agentName: z.string().min(1).max(40).default("Riya"),
  voiceId: z.string().min(1).default("cgSgspJ2msm6clMCkdW9"),
  languages: z
    .object({
      hindi: z.boolean().default(true),
      english: z.boolean().default(true),
      autoSwitch: z.boolean().default(true),
    })
    .default({ hindi: true, english: true, autoSwitch: true }),
  firstMessage: z
    .string()
    .min(1)
    .max(500)
    .default(
      "Namaste! NexGen Hair Transplant mein aapka swagat hai. Main Riya hoon. Aap Hindi mein baat karna chahenge ya English mein?",
    ),
  hours: z
    .object({
      days: z.enum(["mon_sat", "every_day"]).default("mon_sat"),
      open: time.default("10:00"),
      close: time.default("19:00"),
    })
    .default({ days: "mon_sat", open: "10:00", close: "19:00" }),
  afterHours: z.enum(["answer", "message"]).default("answer"),
  booking: z
    .object({
      doctorName: z.string().min(1).default("Dr. Nilesh Kumar"),
      slotMinutes: z.union([z.literal(30), z.literal(45), z.literal(60)]).default(30),
      reminderEveningBefore: z.boolean().default(true),
    })
    .default({ doctorName: "Dr. Nilesh Kumar", slotMinutes: 30, reminderEveningBefore: true }),
  transfer: z
    .object({
      frontDeskNumber: z.string().default(""),
      onRequest: z.boolean().default(true),
      onComplaint: z.boolean().default(true),
      onUnsure: z.boolean().default(true),
    })
    .default({ frontDeskNumber: "", onRequest: true, onComplaint: true, onUnsure: true }),
  delivery: z
    .object({
      clinicOs: z.boolean().default(true),
      whatsapp: z.boolean().default(true),
      sheet: z.boolean().default(false),
    })
    .default({ clinicOs: true, whatsapp: true, sheet: false }),
  guardrails: z
    .object({
      noDiagnosis: z.boolean().default(true),
      rangeOnly: z.boolean().default(true),
      noGuarantee: z.boolean().default(true),
      recordingNotice: z.boolean().default(true),
    })
    .default({ noDiagnosis: true, rangeOnly: true, noGuarantee: true, recordingNotice: true }),
  /** ElevenLabs tool ids registered by `npm run elevenlabs:setup`. Managed by the server. */
  toolIds: z.array(z.string()).default([]),
});

export type Settings = z.infer<typeof settingsSchema>;

/** What staff may change from the app (toolIds is server-managed). */
export const settingsUpdateSchema = settingsSchema.omit({ toolIds: true }).partial();

export async function getSettings(): Promise<Settings> {
  const row = await db.query.agentSettings.findFirst({ where: eq(agentSettings.id, 1) });
  return settingsSchema.parse(row?.data ?? {});
}

export async function getSettingsRow() {
  const row = await db.query.agentSettings.findFirst({ where: eq(agentSettings.id, 1) });
  return {
    settings: settingsSchema.parse(row?.data ?? {}),
    lastSyncedAt: row?.lastSyncedAt ?? null,
    lastSyncError: row?.lastSyncError ?? null,
  };
}

export async function saveSettings(next: Settings): Promise<Settings> {
  const data = settingsSchema.parse(next);
  await db
    .insert(agentSettings)
    .values({ id: 1, data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: agentSettings.id, set: { data, updatedAt: new Date() } });
  return data;
}

export async function recordSync(error: string | null) {
  await db
    .update(agentSettings)
    .set(error ? { lastSyncError: error } : { lastSyncedAt: new Date(), lastSyncError: null })
    .where(eq(agentSettings.id, 1));
}
