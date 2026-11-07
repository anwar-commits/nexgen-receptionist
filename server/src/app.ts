import cors from "cors";
import express from "express";
import helmet from "helmet";
import { corsOrigins } from "./config.js";
import { errorHandler, notFoundHandler } from "./lib/http.js";
import { agentToolsRouter } from "./routes/agentTools.js";
import { appointmentsRouter } from "./routes/appointments.js";
import { authRouter, usersRouter } from "./routes/auth.js";
import { callbacksRouter } from "./routes/callbacks.js";
import { callsRouter } from "./routes/calls.js";
import { knowledgeRouter } from "./routes/knowledge.js";
import { leadsRouter } from "./routes/leads.js";
import { settingsRouter } from "./routes/settings.js";
import { statsRouter } from "./routes/stats.js";
import { webhooksRouter } from "./routes/webhooks.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: corsOrigins }));

  // Webhooks read the raw body for signature checks, so they go before express.json().
  app.use("/api/webhooks", webhooksRouter);
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/calls", callsRouter);
  app.use("/api/leads", leadsRouter);
  app.use("/api/appointments", appointmentsRouter);
  app.use("/api/callbacks", callbacksRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/knowledge", knowledgeRouter);
  app.use("/api/agent-tools", agentToolsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
