import type { AppointmentStatus, LeadStatus, Outcome } from "./types";

export interface Tone {
  label: string;
  bg: string;
  fg: string;
}

const IST = "Asia/Kolkata";

export const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));

export const formatDay = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));

export const formatDateTime = (iso: string) => `${formatDay(iso)}, ${formatTime(iso)}`;

export function isToday(iso: string) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: IST });
  return f.format(new Date(iso)) === f.format(new Date());
}

/** "Today, 7:52 PM" or "Thu 5 Nov, 7:52 PM" */
export const formatWhen = (iso: string) => (isToday(iso) ? `Today, ${formatTime(iso)}` : formatDateTime(iso));

export function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function todayIst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date());
}

export const formatPhone = (phone: string | null) => {
  if (!phone) return "Unknown number";
  const m = phone.match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
};

export const callerLabel = (c: { callerName: string | null; callerPhone: string | null; city?: string | null }) =>
  [c.callerName ?? formatPhone(c.callerPhone), c.city].filter(Boolean).join(" · ");

export const OUTCOME: Record<Outcome, Tone> = {
  booked: { label: "Booked", bg: "#DCFCE7", fg: "#166534" },
  lead_qualified: { label: "Lead qualified", bg: "#DBEAFE", fg: "#1E40AF" },
  transferred: { label: "Transferred", bg: "#FEF3C7", fg: "#92400E" },
  callback_requested: { label: "Callback", bg: "#FEF3C7", fg: "#92400E" },
  answered: { label: "Answered", bg: "#F1F5F9", fg: "#334155" },
  no_engagement: { label: "No answer", bg: "#F1F5F9", fg: "#334155" },
};

export const LEAD_STATUS: Record<LeadStatus, Tone> = {
  new: { label: "New", bg: "#F1F5F9", fg: "#334155" },
  qualified: { label: "Qualified", bg: "#DBEAFE", fg: "#1E40AF" },
  booked: { label: "Booked", bg: "#DCFCE7", fg: "#166534" },
  converted: { label: "Converted", bg: "#CCFBF1", fg: "#134E4A" },
  lost: { label: "Lost", bg: "#FEE2E2", fg: "#991B1B" },
};

export const APPT_STATUS: Record<AppointmentStatus, Tone> = {
  scheduled: { label: "Scheduled", bg: "#CCFBF1", fg: "#134E4A" },
  completed: { label: "Completed", bg: "#DCFCE7", fg: "#166534" },
  cancelled: { label: "Cancelled", bg: "#F1F5F9", fg: "#334155" },
  no_show: { label: "No-show", bg: "#FEE2E2", fg: "#991B1B" },
};

export const INTENT: Record<string, string> = {
  treatment_info: "Treatment info",
  cost_question: "Cost question",
  book_consultation: "Book consultation",
  talk_to_person: "Talk to a person",
  clinic_info: "Clinic address / timings",
  post_surgery: "Post-surgery",
  other: "Other",
};

export const intentLabel = (i: string | null) => (i ? (INTENT[i] ?? i) : "—");
