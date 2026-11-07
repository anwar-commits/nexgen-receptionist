import { desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { callbacks } from "../db/schema.js";
import { requireAuth } from "../lib/auth.js";
import { notFound, param } from "../lib/http.js";
import { broadcast } from "../lib/realtime.js";

export const callbacksRouter = Router();
callbacksRouter.use(requireAuth);

callbacksRouter.get("/", async (req, res) => {
  const { status } = z.object({ status: z.enum(["pending", "done"]).optional() }).parse(req.query);
  const rows = await db
    .select()
    .from(callbacks)
    .where(status ? eq(callbacks.status, status) : undefined)
    .orderBy(desc(callbacks.createdAt))
    .limit(100);
  res.json({ callbacks: rows });
});

callbacksRouter.patch("/:id", async (req, res) => {
  const { status } = z.object({ status: z.enum(["pending", "done"]) }).parse(req.body);
  const [row] = await db
    .update(callbacks)
    .set({ status, doneAt: status === "done" ? new Date() : null, updatedAt: new Date() })
    .where(eq(callbacks.id, param(req.params.id)))
    .returning();
  if (!row) throw notFound("Callback");
  broadcast("callback:updated", { id: row.id });
  res.json({ callback: row });
});
