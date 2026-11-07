/** India Standard Time helpers. IST is a fixed UTC+05:30 with no daylight saving. */
const IST_OFFSET_MS = 330 * 60 * 1000;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface IstParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

export function istParts(date: Date): IstParts {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" of the given instant in IST. */
export function istDate(date: Date): string {
  const p = istParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** The UTC instant for an IST calendar date + "HH:MM". */
export function fromIst(dateStr: string, time = "00:00"): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MS);
}

export function istStartOfDay(date: Date): Date {
  return fromIst(istDate(date));
}

export function addDays(dateStr: string, days: number): string {
  const d = fromIst(dateStr, "12:00");
  return istDate(new Date(d.getTime() + days * 86400000));
}

export function weekdayOf(dateStr: string): number {
  return istParts(fromIst(dateStr, "12:00")).weekday;
}

/** "Sat 7 Nov" */
export function formatIstDay(dateStr: string): string {
  const p = istParts(fromIst(dateStr, "12:00"));
  return `${WEEKDAYS[p.weekday]} ${p.day} ${MONTHS[p.month - 1]}`;
}

/** "11:00" -> "11:00 AM" */
export function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${suffix}`;
}

/** "Sat 7 Nov, 11:00 AM" */
export function formatIstDateTime(date: Date): string {
  const p = istParts(date);
  return `${formatIstDay(istDate(date))}, ${formatTime12(`${pad(p.hour)}:${pad(p.minute)}`)}`;
}

export function istTime(date: Date): string {
  const p = istParts(date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

const DAY_WORDS: Record<string, number> = {
  sunday: 0, sun: 0, ravivar: 0, itwar: 0, raviwar: 0,
  monday: 1, mon: 1, somvar: 1, somwar: 1,
  tuesday: 2, tue: 2, mangalvar: 2, mangalwar: 2,
  wednesday: 3, wed: 3, budhvar: 3, budhwar: 3,
  thursday: 4, thu: 4, guruvar: 4, guruwar: 4, brihaspativar: 4,
  friday: 5, fri: 5, shukravar: 5, shukrawar: 5,
  saturday: 6, sat: 6, shanivar: 6, shaniwar: 6,
};

/**
 * Turn what the agent heard ("today", "kal", "saturday", "2026-11-07", "7/11") into an IST date.
 * Returns null if it can't be understood.
 */
export function resolveDay(input: string, now = new Date()): string | null {
  const s = input.trim().toLowerCase();
  const today = istDate(now);
  if (!s || ["today", "aaj", "aj"].includes(s)) return today;
  if (["tomorrow", "kal", "tmrw"].includes(s)) return addDays(today, 1);
  if (["day after tomorrow", "parso", "parson"].includes(s)) return addDays(today, 2);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dm = s.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]);
    let year = dm[3] ? Number(dm[3]) : istParts(now).year;
    if (year < 100) year += 2000;
    const candidate = `${year}-${pad(month)}-${pad(day)}`;
    if (!dm[3] && candidate < today) return `${year + 1}-${pad(month)}-${pad(day)}`;
    return candidate;
  }
  const word = s.replace(/^(next|this|agle|is)\s+/, "");
  if (word in DAY_WORDS) {
    const target = DAY_WORDS[word];
    const current = weekdayOf(today);
    let diff = (target - current + 7) % 7;
    if (diff === 0) diff = s.startsWith("next") || s.startsWith("agle") ? 7 : 0;
    return addDays(today, diff);
  }
  return null;
}
