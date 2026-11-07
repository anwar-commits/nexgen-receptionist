import express, { Router } from "express";
import { config } from "../config.js";
import { verifyWebhookSignature } from "../lib/elevenlabs.js";
import { ingestPostCall, type PostCallData } from "../services/callIngest.js";

export const webhooksRouter = Router();

/**
 * ElevenLabs post-call webhook. Configure in the ElevenLabs dashboard:
 *   Agents → Settings → Post-call webhook → https://<server>/api/webhooks/elevenlabs
 * The raw body is needed to check the HMAC signature.
 */
webhooksRouter.post("/elevenlabs", express.raw({ type: "*/*", limit: "5mb" }), async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  if (!config.ELEVENLABS_WEBHOOK_SECRET) {
    res.status(503).json({ error: "ELEVENLABS_WEBHOOK_SECRET is not set" });
    return;
  }
  if (!verifyWebhookSignature(raw, req.header("elevenlabs-signature"))) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }
  let event: { type?: string; data?: PostCallData };
  try {
    event = JSON.parse(raw);
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }
  if (event.type !== "post_call_transcription" || !event.data?.conversation_id) {
    // Audio and other event types are acknowledged and ignored.
    res.json({ ok: true, ignored: event.type });
    return;
  }
  if (config.ELEVENLABS_AGENT_ID && event.data.agent_id && event.data.agent_id !== config.ELEVENLABS_AGENT_ID) {
    res.json({ ok: true, ignored: "other agent" });
    return;
  }
  const call = await ingestPostCall(event.data);
  res.json({ ok: true, callId: call.id });
});
