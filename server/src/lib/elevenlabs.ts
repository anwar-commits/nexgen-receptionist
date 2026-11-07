import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { HttpError } from "./http.js";

const BASE = "https://api.elevenlabs.io";

export function elevenlabsConfigured(): boolean {
  return Boolean(config.ELEVENLABS_API_KEY && config.ELEVENLABS_AGENT_ID);
}

function requireKey(): string {
  if (!config.ELEVENLABS_API_KEY) throw new HttpError(503, "ElevenLabs API key is not set on the server");
  return config.ELEVENLABS_API_KEY;
}

export function agentId(): string {
  if (!config.ELEVENLABS_AGENT_ID) throw new HttpError(503, "ELEVENLABS_AGENT_ID is not set on the server");
  return config.ELEVENLABS_AGENT_ID;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "xi-api-key": requireKey(),
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new HttpError(502, `ElevenLabs ${init.method ?? "GET"} ${path} failed (${res.status})`, body.slice(0, 500));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---- Agents -------------------------------------------------------------

export interface AgentDoc {
  agent_id: string;
  conversation_config: {
    agent?: {
      first_message?: string;
      language?: string;
      prompt?: Record<string, unknown> & {
        prompt?: string;
        tool_ids?: string[];
        knowledge_base?: KnowledgeBaseRef[];
        built_in_tools?: Record<string, unknown>;
      };
    };
    tts?: Record<string, unknown> & { voice_id?: string };
  };
}

export interface KnowledgeBaseRef {
  type: "text" | "file" | "url";
  name: string;
  id: string;
  usage_mode?: "auto" | "prompt";
}

export const getAgent = () => call<AgentDoc>(`/v1/convai/agents/${agentId()}`);

export const patchAgent = (body: unknown) =>
  call<AgentDoc>(`/v1/convai/agents/${agentId()}`, { method: "PATCH", body: JSON.stringify(body) });

// ---- Knowledge base -----------------------------------------------------

export const createTextDoc = (name: string, text: string) =>
  call<{ id: string; name: string }>(`/v1/convai/knowledge-base/text`, {
    method: "POST",
    body: JSON.stringify({ name, text }),
  });

export async function deleteDoc(id: string) {
  try {
    await call(`/v1/convai/knowledge-base/${id}?force=true`, { method: "DELETE" });
  } catch (err) {
    console.warn(`Could not delete ElevenLabs doc ${id}:`, (err as Error).message);
  }
}

// ---- Tools --------------------------------------------------------------

export const createTool = (toolConfig: unknown) =>
  call<{ id: string }>(`/v1/convai/tools`, { method: "POST", body: JSON.stringify({ tool_config: toolConfig }) });

export const updateTool = (id: string, toolConfig: unknown) =>
  call<{ id: string }>(`/v1/convai/tools/${id}`, { method: "PATCH", body: JSON.stringify({ tool_config: toolConfig }) });

// ---- Conversations ------------------------------------------------------

export interface ConversationSummary {
  conversation_id: string;
  agent_id: string;
  status: string; // "initiated" | "in-progress" | "processing" | "done" | "failed"
  start_time_unix_secs: number;
  call_duration_secs: number;
}

export const listConversations = (pageSize = 20) =>
  call<{ conversations: ConversationSummary[] }>(
    `/v1/convai/conversations?agent_id=${agentId()}&page_size=${pageSize}`,
  );

export interface ConversationDetail {
  conversation_id: string;
  status: string;
  transcript: { role: string; message: string | null; time_in_call_secs?: number }[];
  metadata?: {
    start_time_unix_secs?: number;
    call_duration_secs?: number;
    phone_call?: { external_number?: string; direction?: string } | null;
  };
  analysis?: unknown;
  conversation_initiation_client_data?: { dynamic_variables?: Record<string, unknown> } | null;
}

export const getConversation = (id: string) => call<ConversationDetail>(`/v1/convai/conversations/${id}`);

export async function fetchConversationAudio(id: string): Promise<Response> {
  const res = await fetch(`${BASE}/v1/convai/conversations/${id}/audio`, {
    headers: { "xi-api-key": requireKey() },
  });
  if (!res.ok) throw new HttpError(res.status === 404 ? 404 : 502, "Recording is not available for this call");
  return res;
}

// ---- Webhook signature --------------------------------------------------

/**
 * ElevenLabs signs webhooks with header `ElevenLabs-Signature: t=<unix>,v0=<hex hmac>`
 * where the HMAC-SHA256 is over `${t}.${rawBody}` using the webhook secret.
 */
export function verifyWebhookSignature(rawBody: string, header: string | undefined, toleranceSecs = 30 * 60): boolean {
  if (!config.ELEVENLABS_WEBHOOK_SECRET) return false;
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=").trim()];
    }),
  );
  const t = Number(parts.t);
  const sig = parts.v0;
  if (!t || !sig) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSecs) return false;
  const expected = createHmac("sha256", config.ELEVENLABS_WEBHOOK_SECRET).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
