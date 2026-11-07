import "dotenv/config";
import { z } from "zod";

const opt = z.string().optional().transform((v) => (v && v.trim() ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  PUBLIC_URL: opt,

  ELEVENLABS_API_KEY: opt,
  ELEVENLABS_AGENT_ID: opt,
  ELEVENLABS_WEBHOOK_SECRET: opt,
  AGENT_TOOL_SECRET: z.string().min(8, "AGENT_TOOL_SECRET must be at least 8 characters"),

  WHATSAPP_TOKEN: opt,
  WHATSAPP_PHONE_NUMBER_ID: opt,
  WHATSAPP_TPL_BOOKING: opt,
  WHATSAPP_TPL_LEAD_ALERT: opt,
  WHATSAPP_TPL_REMINDER: opt,
  WHATSAPP_TEMPLATE_LANG: z.string().default("en"),
  COUNSELLOR_WHATSAPP: opt,
  CLINIC_OS_WEBHOOK_URL: opt,
  CLINIC_OS_WEBHOOK_TOKEN: opt,
  GOOGLE_SHEET_WEBHOOK_URL: opt,
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

export const config = parsed.data;
export const corsOrigins = config.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
