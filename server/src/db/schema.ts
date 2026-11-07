import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "front_desk", "counsellor"]);
export const callOutcome = pgEnum("call_outcome", [
  "booked",
  "lead_qualified",
  "transferred",
  "callback_requested",
  "answered",
  "no_engagement",
]);
export const callStatus = pgEnum("call_status", ["live", "ended", "failed"]);
export const leadStatus = pgEnum("lead_status", ["new", "qualified", "booked", "converted", "lost"]);
export const appointmentStatus = pgEnum("appointment_status", ["scheduled", "completed", "cancelled", "no_show"]);
export const callbackStatus = pgEnum("callback_status", ["pending", "done"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("front_desk"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

/** Single-row table (id = 1) holding the agent's settings as validated JSON. */
export const agentSettings = pgTable("agent_settings", {
  id: integer("id").primaryKey(),
  data: jsonb("data").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastSyncError: text("last_sync_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone").notNull().unique(),
    name: text("name"),
    city: text("city"),
    concern: text("concern"),
    hairLossDuration: text("hair_loss_duration"),
    treatmentInterest: text("treatment_interest"),
    hairLossStage: text("hair_loss_stage"),
    budget: text("budget"),
    source: text("source"),
    status: leadStatus("status").notNull().default("new"),
    assignedToId: uuid("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("leads_status_idx").on(t.status), index("leads_created_idx").on(t.createdAt)],
);

export const calls = pgTable(
  "calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: text("conversation_id").notNull().unique(),
    callerPhone: text("caller_phone"),
    callerName: text("caller_name"),
    city: text("city"),
    language: text("language"),
    intent: text("intent"),
    outcome: callOutcome("outcome"),
    status: callStatus("status").notNull().default("ended"),
    durationSecs: integer("duration_secs").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    summary: text("summary"),
    analysis: jsonb("analysis"),
    evaluation: jsonb("evaluation"),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    staffNotes: text("staff_notes"),
    ...timestamps,
  },
  (t) => [index("calls_started_idx").on(t.startedAt), index("calls_phone_idx").on(t.callerPhone)],
);

export const transcriptTurns = pgTable(
  "transcript_turns",
  {
    id: serial("id").primaryKey(),
    callId: uuid("call_id")
      .notNull()
      .references(() => calls.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    role: text("role").notNull(), // "agent" | "user"
    message: text("message").notNull(),
    timeSecs: integer("time_secs").notNull().default(0),
  },
  (t) => [index("turns_call_idx").on(t.callId, t.position)],
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    doctorName: text("doctor_name").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMins: integer("duration_mins").notNull(),
    status: appointmentStatus("status").notNull().default("scheduled"),
    purpose: text("purpose"),
    bookedBy: text("booked_by").notNull().default("agent"), // "agent" | "staff"
    conversationId: text("conversation_id"),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("appointments_starts_idx").on(t.startsAt)],
);

export const callbacks = pgTable("callbacks", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull(),
  name: text("name"),
  reason: text("reason"),
  status: callbackStatus("status").notNull().default("pending"),
  conversationId: text("conversation_id"),
  doneAt: timestamp("done_at", { withTimezone: true }),
  ...timestamps,
});

export const knowledgeDocs = pgTable("knowledge_docs", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  elevenlabsDocId: text("elevenlabs_doc_id"),
  ...timestamps,
});

export const unansweredQuestions = pgTable("unanswered_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  question: text("question").notNull(),
  callerPhone: text("caller_phone"),
  conversationId: text("conversation_id"),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Call = typeof calls.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type KnowledgeDoc = typeof knowledgeDocs.$inferSelect;
