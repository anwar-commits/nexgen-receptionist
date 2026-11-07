export type Role = "admin" | "front_desk" | "counsellor";
export type Outcome = "booked" | "lead_qualified" | "transferred" | "callback_requested" | "answered" | "no_engagement";
export type LeadStatus = "new" | "qualified" | "booked" | "converted" | "lost";
export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show";
export type Range = "today" | "7d" | "30d";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Call {
  id: string;
  conversationId: string;
  callerPhone: string | null;
  callerName: string | null;
  city: string | null;
  language: string | null;
  intent: string | null;
  outcome: Outcome | null;
  status: "live" | "ended" | "failed";
  durationSecs: number;
  startedAt: string;
  summary: string | null;
  leadId: string | null;
  staffNotes: string | null;
}

export interface TranscriptTurn {
  id: number;
  position: number;
  role: "agent" | "user";
  message: string;
  timeSecs: number;
}

export interface Lead {
  id: string;
  phone: string;
  name: string | null;
  city: string | null;
  concern: string | null;
  hairLossDuration: string | null;
  treatmentInterest: string | null;
  hairLossStage: string | null;
  budget: string | null;
  source: string | null;
  status: LeadStatus;
  assignedToId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  leadId: string;
  doctorName: string;
  startsAt: string;
  durationMins: number;
  status: AppointmentStatus;
  purpose: string | null;
  bookedBy: "agent" | "staff";
  lead?: { id: string; name: string | null; phone: string; city: string | null };
}

export interface Callback {
  id: string;
  phone: string;
  name: string | null;
  reason: string | null;
  status: "pending" | "done";
  createdAt: string;
}

export interface Stats {
  range: Range;
  calls: number;
  qualifiedLeads: number;
  booked: number;
  handedToStaff: number;
  avgDurationSecs: number;
  pendingCallbacks: number;
  unansweredQuestions: number;
  languages: { language: string; count: number }[];
  topIntents: { intent: string; count: number }[];
}

export interface LiveCall {
  conversationId: string;
  callerPhone: string | null;
  callerLabel: string;
  startedAt: string;
  recentTurns: { role: "agent" | "user"; message: string }[];
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  description: string | null;
  content: string;
  elevenlabsDocId: string | null;
  updatedAt: string;
}

export interface UnansweredQuestion {
  id: string;
  question: string;
  callerPhone: string | null;
  resolved: boolean;
  createdAt: string;
}

export interface Settings {
  clinicName: string;
  clinicCity: string;
  agentName: string;
  voiceId: string;
  languages: { hindi: boolean; english: boolean; autoSwitch: boolean };
  firstMessage: string;
  hours: { days: "mon_sat" | "every_day"; open: string; close: string };
  afterHours: "answer" | "message";
  booking: { doctorName: string; slotMinutes: 30 | 45 | 60; reminderEveningBefore: boolean };
  transfer: { frontDeskNumber: string; onRequest: boolean; onComplaint: boolean; onUnsure: boolean };
  delivery: { clinicOs: boolean; whatsapp: boolean; sheet: boolean };
  guardrails: { noDiagnosis: boolean; rangeOnly: boolean; noGuarantee: boolean; recordingNotice: boolean };
}

export interface SyncStatus {
  configured: boolean;
  toolsRegistered: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}
