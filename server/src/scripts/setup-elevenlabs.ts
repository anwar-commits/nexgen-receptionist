/**
 * One-time (and re-runnable) setup of the ElevenLabs agent:
 *  1. registers/updates the webhook tools that point at this server,
 *  2. uploads knowledge-base docs that aren't on ElevenLabs yet,
 *  3. pushes the prompt, voice, first message, transfer number and KB to the agent.
 *
 * Needs PUBLIC_URL (HTTPS), ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID and AGENT_TOOL_SECRET in .env.
 */
import { eq, isNull } from "drizzle-orm";
import { config } from "../config.js";
import { db, pool } from "../db/index.js";
import { knowledgeDocs } from "../db/schema.js";
import { createTextDoc, createTool, updateTool } from "../lib/elevenlabs.js";
import { getSettings, saveSettings } from "../lib/settings.js";
import { syncAgent } from "../services/agentSync.js";

if (!config.PUBLIC_URL?.startsWith("https://")) {
  console.error("PUBLIC_URL must be the server's public https:// address (ElevenLabs calls it during phone calls).");
  process.exit(1);
}
if (!config.ELEVENLABS_API_KEY || !config.ELEVENLABS_AGENT_ID) {
  console.error("Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in .env.");
  process.exit(1);
}

const base = `${config.PUBLIC_URL.replace(/\/$/, "")}/api/agent-tools`;
const str = (description: string) => ({ type: "string", description });
const fromVar = (variable: string) => ({ type: "string", dynamic_variable: variable });

const tools = [
  {
    name: "check_availability",
    description: "Find free consultation slots. Call before offering times to the caller.",
    properties: {
      day: str('Day the caller wants: "today", "tomorrow", a weekday like "saturday", or a date as YYYY-MM-DD.'),
    },
    required: ["day"],
  },
  {
    name: "book_appointment",
    description: "Book a consultation once the caller has agreed to a specific date and time returned by check_availability.",
    properties: {
      caller_phone: fromVar("system__caller_id"),
      conversation_id: fromVar("system__conversation_id"),
      name: str("Caller's name"),
      date: str("Date as YYYY-MM-DD, exactly as returned by check_availability"),
      time: str('24-hour time as HH:MM, exactly as returned by check_availability, e.g. "11:00"'),
      city: str("Caller's city, if known"),
      concern: str("Hair problem in a few words, if known"),
      treatment_interest: str("Treatment the caller is interested in, if known"),
    },
    required: ["name", "date", "time"],
  },
  {
    name: "save_lead",
    description: "Save what you learned about the caller so a counsellor can follow up. Call before ending any call where you learned the caller's name or need.",
    properties: {
      caller_phone: fromVar("system__caller_id"),
      name: str("Caller's name, if given"),
      city: str("Caller's city, if given"),
      concern: str("Hair problem in a few words, e.g. 'frontal hair loss'"),
      hair_loss_duration: str("How long they have had the problem, e.g. '2 years'"),
      treatment_interest: str("Treatment they are interested in: FUE, FUT, PRP, beard transplant, not sure"),
      budget: str("Budget, only if the caller mentioned it"),
      source: str("How they heard about the clinic, if mentioned"),
    },
    required: [],
  },
  {
    name: "request_callback",
    description: "Ask the front desk to call the caller back (when a transfer isn't possible or nobody answered).",
    properties: {
      caller_phone: fromVar("system__caller_id"),
      conversation_id: fromVar("system__conversation_id"),
      name: str("Caller's name, if known"),
      reason: str("Why they need a callback, in one sentence"),
    },
    required: ["reason"],
  },
  {
    name: "log_unanswered_question",
    description: "Record a question you could not answer from the knowledge base, so staff can add the answer.",
    properties: {
      caller_phone: fromVar("system__caller_id"),
      conversation_id: fromVar("system__conversation_id"),
      question: str("The caller's question"),
    },
    required: ["question"],
  },
];

const settings = await getSettings();
const existingIds = new Map<string, string>();
settings.toolIds.forEach((id, i) => tools[i] && existingIds.set(tools[i].name, id));

const toolIds: string[] = [];
for (const t of tools) {
  const toolConfig = {
    type: "webhook",
    name: t.name,
    description: t.description,
    response_timeout_secs: 20,
    api_schema: {
      url: `${base}/${t.name}`,
      method: "POST",
      request_headers: { "x-agent-secret": config.AGENT_TOOL_SECRET },
      request_body_schema: {
        type: "object",
        description: t.description,
        properties: t.properties,
        required: t.required,
      },
    },
  };
  const existing = existingIds.get(t.name);
  if (existing) {
    await updateTool(existing, toolConfig);
    toolIds.push(existing);
    console.log(`Updated tool ${t.name}`);
  } else {
    const { id } = await createTool(toolConfig);
    toolIds.push(id);
    console.log(`Created tool ${t.name} (${id})`);
  }
}
await saveSettings({ ...settings, toolIds });

const pending = await db.select().from(knowledgeDocs).where(isNull(knowledgeDocs.elevenlabsDocId));
for (const doc of pending) {
  const { id } = await createTextDoc(doc.title, doc.content);
  await db.update(knowledgeDocs).set({ elevenlabsDocId: id }).where(eq(knowledgeDocs.id, doc.id));
  console.log(`Uploaded knowledge doc "${doc.title}"`);
}

const result = await syncAgent();
console.log(result.synced ? "Agent synced." : `Agent sync failed: ${result.error}`);
await pool.end();
process.exit(result.synced ? 0 : 1);
