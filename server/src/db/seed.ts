import bcrypt from "bcryptjs";
import { count, eq } from "drizzle-orm";
import { db, pool } from "./index.js";
import {
  appointments,
  callbacks,
  calls,
  knowledgeDocs,
  leads,
  transcriptTurns,
  unansweredQuestions,
  users,
} from "./schema.js";
import { getSettings, saveSettings } from "../lib/settings.js";
import { addDays, fromIst, istDate } from "../lib/time.js";

const demo = process.argv.includes("--demo");

// 1. First admin
const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@nexgenhair.in").toLowerCase();
const existingAdmin = await db.query.users.findFirst({ where: eq(users.email, email) });
if (!existingAdmin) {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    console.error("Set SEED_ADMIN_PASSWORD (8+ characters) in .env before seeding.");
    process.exit(1);
  }
  await db.insert(users).values({
    name: process.env.SEED_ADMIN_NAME ?? "Admin",
    email,
    role: "admin",
    passwordHash: await bcrypt.hash(password, 10),
  });
  console.log(`Created admin ${email}`);
}

// 2. Default settings (keeps anything already saved)
await saveSettings(await getSettings());

// 3. Starter knowledge base. Text in [BRACKETS] must be filled in before going live.
const [{ n: docCount }] = await db.select({ n: count() }).from(knowledgeDocs);
if (docCount === 0) {
  await db.insert(knowledgeDocs).values([
    {
      title: "Treatments and FAQs",
      description: "FUE, FUT, PRP, recovery, pain, results timeline",
      content: `NexGen Hair Transplant offers surgical and non-surgical hair treatments.

FUE (Follicular Unit Extraction): individual hair follicles are taken from the back of the head and implanted where hair is thinning. No linear scar. [CONFIRM: typical session length at our clinic]
FUT (Follicular Unit Transplantation): a strip of scalp is taken from the back of the head and divided into grafts. [CONFIRM: whether we offer FUT]
PRP (Platelet-Rich Plasma): the patient's own blood is processed and injected into the scalp to support hair growth. Usually done as a course of sessions. [CONFIRM: number of sessions we recommend]
Beard and eyebrow transplant: [CONFIRM: offered or not]

Is it painful? The procedure is done under local anaesthesia. [CONFIRM: clinic's standard explanation]
Recovery: [CONFIRM: days off work, when to wash hair]
When do results show? [CONFIRM: clinic's standard timeline]
The exact treatment and number of grafts are decided by the doctor at the consultation.`,
    },
    {
      title: "Price ranges",
      description: "Ranges only, never a final quote",
      content: `Only share ranges. The final cost depends on the number of grafts the doctor recommends at the consultation.
FUE hair transplant: [YOUR PRICE RANGE]
FUT hair transplant: [YOUR PRICE RANGE]
PRP per session: [YOUR PRICE]
Consultation fee: [YOUR CONSULTATION FEE or "free"]
EMI / payment options: [CONFIRM]`,
    },
    {
      title: "Clinic address, timings and directions",
      description: "Patna clinic, parking, landmarks",
      content: `Clinic: NexGen Hair Transplant, Patna, Bihar.
Address: [FULL ADDRESS]
Landmark: [NEARBY LANDMARK]
Timings: [DAYS AND HOURS]
Parking: [PARKING INFO]
Google Maps link is sent on WhatsApp after booking.`,
    },
    {
      title: "Doctor profile",
      description: "Dr. Nilesh Kumar",
      content: `Lead surgeon: Dr. Nilesh Kumar.
Qualifications: [QUALIFICATIONS]
Experience: [YEARS / PROCEDURES]`,
    },
  ]);
  console.log("Added starter knowledge base (fill in the [BRACKETS] before going live).");
}

// 4. Optional demo data so the dashboard has something to show
if (demo) {
  const [{ n: callCount }] = await db.select({ n: count() }).from(calls);
  if (callCount > 0) {
    console.log("Calls already exist; skipping demo data.");
  } else {
    const today = istDate(new Date());
    const tomorrow = addDays(today, 1);
    const people = [
      { phone: "+919812345412", name: "Rahul K.", city: "Patna", concern: "Frontal hair loss", dur: "2 years", interest: "Transplant", outcome: "booked", intent: "book_consultation", lang: "Hindi", secs: 190, at: "19:52" },
      { phone: "+917012345219", name: null, city: "Gaya", concern: "Thinning crown", dur: null, interest: "FUE", outcome: "lead_qualified", intent: "cost_question", lang: "Hindi", secs: 125, at: "19:31" },
      { phone: "+919912345803", name: null, city: null, concern: null, dur: null, interest: null, outcome: "transferred", intent: "talk_to_person", lang: "Hindi", secs: 48, at: "18:20" },
      { phone: "+918112345577", name: null, city: null, concern: null, dur: null, interest: null, outcome: "answered", intent: "clinic_info", lang: "Hindi", secs: 55, at: "17:10" },
      { phone: "+919934512345", name: "Priya S.", city: "Muzaffarpur", concern: "Hair fall", dur: "1 year", interest: "PRP", outcome: "lead_qualified", intent: "treatment_info", lang: "English", secs: 161, at: "16:58" },
    ] as const;
    for (const [i, p] of people.entries()) {
      let leadId: string | null = null;
      if (p.name || p.concern) {
        const [lead] = await db
          .insert(leads)
          .values({
            phone: p.phone,
            name: p.name,
            city: p.city,
            concern: p.concern,
            hairLossDuration: p.dur,
            treatmentInterest: p.interest,
            source: "Google search",
            status: p.outcome === "booked" ? "booked" : "qualified",
          })
          .returning();
        leadId = lead.id;
        if (p.outcome === "booked") {
          await db.insert(appointments).values({
            leadId,
            doctorName: "Dr. Nilesh Kumar",
            startsAt: fromIst(tomorrow, "11:00"),
            durationMins: 30,
            purpose: "Transplant consultation",
            bookedBy: "agent",
          });
        }
      }
      const [call] = await db
        .insert(calls)
        .values({
          conversationId: `demo_conv_${i + 1}`,
          callerPhone: p.phone,
          callerName: p.name,
          city: p.city,
          language: p.lang,
          intent: p.intent,
          outcome: p.outcome,
          durationSecs: p.secs,
          startedAt: fromIst(today, p.at),
          summary:
            p.outcome === "booked"
              ? "Caller from Patna with frontal hair loss for 2 years asked about a transplant. Booked a consultation with Dr. Nilesh Kumar for tomorrow 11:00 AM."
              : "Demo call.",
          leadId,
        })
        .returning();
      if (p.outcome === "booked") {
        const lines: [string, string][] = [
          ["agent", "Namaste! NexGen Hair Transplant mein aapka swagat hai. Main Riya hoon. Aap Hindi mein baat karna chahenge ya English mein?"],
          ["user", "Hindi."],
          ["agent", "Ji zaroor. Bataiye, main aapki kya madad kar sakti hoon?"],
          ["user", "Mere aage se baal kaafi kam ho gaye hain. Transplant ke baare mein jaanna tha."],
          ["agent", "Samajh gayi. Ye kitne samay se ho raha hai, aur aap kis shehar se hain?"],
          ["user", "Do saal se. Patna se hi hoon."],
          ["agent", "Dr. Nilesh Kumar consultation mein scalp check karke sahi treatment batayenge. Kal subah 11 baje ka slot khaali hai. Book kar doon?"],
          ["user", "Haan, kar dijiye."],
          ["agent", "Ho gaya! Confirmation aur clinic ka address aapko WhatsApp par mil jayega. Dhanyavaad!"],
        ];
        await db.insert(transcriptTurns).values(
          lines.map(([role, message], position) => ({ callId: call.id, position, role, message, timeSecs: position * 6 })),
        );
      }
    }
    await db.insert(callbacks).values({ phone: "+919912345803", reason: "Wants to talk to the doctor about a previous surgery" });
    await db.insert(unansweredQuestions).values({ question: "Do you offer EMI for transplant?", callerPhone: "+917012345219" });
    console.log("Added demo calls, leads and an appointment.");
  }
}

await pool.end();
console.log("Seed complete.");
