import { asc, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { knowledgeDocs, unansweredQuestions } from "../db/schema.js";
import { requireAuth, requireRole } from "../lib/auth.js";
import { createTextDoc, deleteDoc, elevenlabsConfigured } from "../lib/elevenlabs.js";
import { notFound, param } from "../lib/http.js";
import { syncAgent } from "../services/agentSync.js";

export const knowledgeRouter = Router();
knowledgeRouter.use(requireAuth);

knowledgeRouter.get("/", async (_req, res) => {
  res.json({ docs: await db.select().from(knowledgeDocs).orderBy(asc(knowledgeDocs.createdAt)) });
});

const docSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(300).nullable().optional(),
  content: z.string().min(1).max(100_000),
});

/** Upload the text to ElevenLabs (a new doc each time; docs there are immutable) and re-attach to the agent. */
async function pushDoc(title: string, content: string, oldDocId?: string | null) {
  if (!elevenlabsConfigured()) return { docId: oldDocId ?? null, sync: { synced: false, error: "ElevenLabs not configured" } };
  const created = await createTextDoc(title, content);
  return { docId: created.id, sync: null };
}

knowledgeRouter.post("/", requireRole("admin"), async (req, res) => {
  const body = docSchema.parse(req.body);
  const pushed = await pushDoc(body.title, body.content);
  const [doc] = await db
    .insert(knowledgeDocs)
    .values({ ...body, elevenlabsDocId: pushed.docId })
    .returning();
  const sync = pushed.sync ?? (await syncAgent());
  res.status(201).json({ doc, sync });
});

knowledgeRouter.put("/:id", requireRole("admin"), async (req, res) => {
  const id = param(req.params.id);
  const body = docSchema.parse(req.body);
  const existing = await db.query.knowledgeDocs.findFirst({ where: eq(knowledgeDocs.id, id) });
  if (!existing) throw notFound("Document");
  const changed = existing.content !== body.content || existing.title !== body.title;
  const pushed = changed ? await pushDoc(body.title, body.content, existing.elevenlabsDocId) : { docId: existing.elevenlabsDocId, sync: null };
  const [doc] = await db
    .update(knowledgeDocs)
    .set({ ...body, elevenlabsDocId: pushed.docId, updatedAt: new Date() })
    .where(eq(knowledgeDocs.id, id))
    .returning();
  const sync = changed ? (pushed.sync ?? (await syncAgent())) : { synced: true };
  if (changed && existing.elevenlabsDocId && existing.elevenlabsDocId !== pushed.docId) await deleteDoc(existing.elevenlabsDocId);
  res.json({ doc, sync });
});

knowledgeRouter.delete("/:id", requireRole("admin"), async (req, res) => {
  const id = param(req.params.id);
  const [doc] = await db.delete(knowledgeDocs).where(eq(knowledgeDocs.id, id)).returning();
  if (!doc) throw notFound("Document");
  const sync = await syncAgent();
  if (doc.elevenlabsDocId) await deleteDoc(doc.elevenlabsDocId);
  res.json({ ok: true, sync });
});

// ---- Questions the agent couldn't answer --------------------------------

knowledgeRouter.get("/unanswered", async (req, res) => {
  const { all } = z.object({ all: z.coerce.boolean().default(false) }).parse(req.query);
  const rows = await db
    .select()
    .from(unansweredQuestions)
    .where(all ? undefined : eq(unansweredQuestions.resolved, false))
    .orderBy(desc(unansweredQuestions.createdAt))
    .limit(100);
  res.json({ questions: rows });
});

knowledgeRouter.patch("/unanswered/:id", async (req, res) => {
  const { resolved } = z.object({ resolved: z.boolean() }).parse(req.body);
  const [row] = await db
    .update(unansweredQuestions)
    .set({ resolved })
    .where(eq(unansweredQuestions.id, param(req.params.id)))
    .returning();
  if (!row) throw notFound("Question");
  res.json({ question: row });
});
