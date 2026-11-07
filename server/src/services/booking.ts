import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { appointments } from "../db/schema.js";
import { HttpError } from "../lib/http.js";
import type { Settings } from "../lib/settings.js";
import {
  addDays,
  formatIstDay,
  formatTime12,
  fromIst,
  istDate,
  minutesToTime,
  timeToMinutes,
  weekdayOf,
} from "../lib/time.js";

/** Minimum notice before a slot can be booked, so the clinic isn't surprised. */
const MIN_NOTICE_MINS = 60;

export function isOpenOn(dateStr: string, s: Settings): boolean {
  return s.hours.days === "every_day" || weekdayOf(dateStr) !== 0;
}

/** Free consultation slots ("HH:MM", IST) on a date. */
export async function freeSlots(dateStr: string, s: Settings, now = new Date()): Promise<string[]> {
  if (!isOpenOn(dateStr, s)) return [];
  const open = timeToMinutes(s.hours.open);
  const close = timeToMinutes(s.hours.close);
  const step = s.booking.slotMinutes;

  const dayStart = fromIst(dateStr);
  const dayEnd = fromIst(addDays(dateStr, 1));
  const booked = await db
    .select({ startsAt: appointments.startsAt, durationMins: appointments.durationMins })
    .from(appointments)
    .where(and(eq(appointments.status, "scheduled"), gte(appointments.startsAt, dayStart), lt(appointments.startsAt, dayEnd)));

  const earliest = now.getTime() + MIN_NOTICE_MINS * 60000;
  const slots: string[] = [];
  for (let m = open; m + step <= close; m += step) {
    const start = fromIst(dateStr, minutesToTime(m)).getTime();
    const end = start + step * 60000;
    if (start < earliest) continue;
    const clash = booked.some((b) => {
      const bs = b.startsAt.getTime();
      const be = bs + b.durationMins * 60000;
      return start < be && bs < end;
    });
    if (!clash) slots.push(minutesToTime(m));
  }
  return slots;
}

/** Availability for the agent: the requested day, or the next open days if it's full. */
export async function availabilityFor(dateStr: string, s: Settings) {
  const result: { date: string; label: string; slots: string[]; slots_spoken: string[] }[] = [];
  let d = dateStr;
  for (let i = 0; i < 7 && result.length < 2; i++, d = addDays(d, 1)) {
    const slots = await freeSlots(d, s);
    if (slots.length) {
      // Spread suggestions across the day rather than listing every half hour.
      const picked = slots.length <= 6 ? slots : [0, 1, 2, 3, 4, 5].map((k) => slots[Math.floor((k * (slots.length - 1)) / 5)]);
      result.push({ date: d, label: formatIstDay(d), slots: picked, slots_spoken: picked.map(formatTime12) });
    }
    if (i === 0 && slots.length) break;
  }
  return result;
}

export async function assertSlotFree(dateStr: string, time: string, s: Settings) {
  if (dateStr < istDate(new Date())) throw new HttpError(409, "That date has already passed");
  const slots = await freeSlots(dateStr, s);
  if (!slots.includes(time)) throw new HttpError(409, "That slot is not available");
}
