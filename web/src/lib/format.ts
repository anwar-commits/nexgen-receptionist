import type { AppointmentStatus, LeadStatus, Outcome } from "./types";

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

export const OUTCOME: Record<Outcome, { label: string; className: string }> = {
  booked: { label: "Booked", className: "bg-green-100 text-green-800" },
  lead_qualified: { label: "Lead qualified", className: "bg-blue-100 text-blue-800" },
  transferred: { label: "Transferred", className: "bg-amber-100 text-amber-800" },
  callback_requested: { label: "Callback", className: "bg-amber-100 text-amber-800" },
  answered: { label: "Answered", className: "bg-slate-100 text-slate-700" },
  no_engagement: { label: "No answer", className: "bg-slate-100 text-slate-700" },
};

export const LEAD_STATUS: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: "New", className: "bg-slate-100 text-slate-700" },
  qualified: { label: "Qualified", className: "bg-blue-100 text-blue-800" },
  booked: { label: "Booked", className: "bg-green-100 text-green-800" },
  converted: { label: "Converted", className: "bg-teal-100 text-teal-900" },
  lost: { label: "Lost", className: "bg-red-100 text-red-800" },
};

export const APPT_STATUS: Record<AppointmentStatus, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "bg-teal-100 text-teal-900" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-700" },
  no_show: { label: "No-show", className: "bg-red-100 text-red-800" },
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
