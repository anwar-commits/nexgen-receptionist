import { Router } from "express";
import { requireAuth, requireRole } from "../lib/auth.js";
import { broadcast } from "../lib/realtime.js";
import { getSettingsRow, saveSettings, settingsUpdateSchema, getSettings } from "../lib/settings.js";
import { elevenlabsConfigured } from "../lib/elevenlabs.js";
import { syncAgent } from "../services/agentSync.js";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get("/", async (_req, res) => {
  const row = await getSettingsRow();
  const { toolIds, ...settings } = row.settings;
  res.json({
    settings,
    sync: {
      configured: elevenlabsConfigured(),
      toolsRegistered: toolIds.length > 0,
      lastSyncedAt: row.lastSyncedAt,
      lastSyncError: row.lastSyncError,
    },
  });
});

settingsRouter.put("/", requireRole("admin"), async (req, res) => {
  const patch = settingsUpdateSchema.parse(req.body);
  const current = await getSettings();
  const merged = await saveSettings({
    ...current,
    ...patch,
    languages: { ...current.languages, ...patch.languages },
    hours: { ...current.hours, ...patch.hours },
    booking: { ...current.booking, ...patch.booking },
    transfer: { ...current.transfer, ...patch.transfer },
    delivery: { ...current.delivery, ...patch.delivery },
    guardrails: { ...current.guardrails, ...patch.guardrails },
  });
  const sync = await syncAgent();
  broadcast("settings:updated");
  const { toolIds, ...settings } = merged;
  res.json({ settings, sync });
});

settingsRouter.post("/sync", requireRole("admin"), async (_req, res) => {
  res.json(await syncAgent());
});
