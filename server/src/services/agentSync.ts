import { isNotNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { knowledgeDocs } from "../db/schema.js";
import { elevenlabsConfigured, getAgent, patchAgent, type KnowledgeBaseRef } from "../lib/elevenlabs.js";
import { buildPrompt } from "../lib/prompt.js";
import { getSettings, recordSync } from "../lib/settings.js";

/**
 * Push the clinic's settings and knowledge base to the ElevenLabs agent.
 * Reads the agent first so that fields this app doesn't manage are kept.
 */
export async function syncAgent(): Promise<{ synced: boolean; error?: string }> {
  if (!elevenlabsConfigured()) {
    const error = "ElevenLabs is not configured on the server (ELEVENLABS_API_KEY / ELEVENLABS_AGENT_ID)";
    await recordSync(error);
    return { synced: false, error };
  }
  try {
    const s = await getSettings();
    const agent = await getAgent();
    const currentPrompt = agent.conversation_config.agent?.prompt ?? {};
    const builtIns = { ...(currentPrompt.built_in_tools ?? {}) } as Record<string, unknown>;

    builtIns.end_call = builtIns.end_call ?? {
      type: "system",
      name: "end_call",
      description: "",
      params: { system_tool_type: "end_call" },
    };

    const frontDesk = s.transfer.frontDeskNumber.trim();
    const transferConditions = [
      s.transfer.onRequest && "the caller asks to talk to a person",
      s.transfer.onComplaint && "the caller has a complaint or a post-surgery problem",
      s.transfer.onUnsure && "the agent could not help after two attempts",
    ].filter(Boolean) as string[];
    builtIns.transfer_to_number =
      frontDesk.startsWith("+") && transferConditions.length
        ? {
            type: "system",
            name: "transfer_to_number",
            description: "",
            params: {
              system_tool_type: "transfer_to_number",
              enable_client_message: true,
              transfers: [
                {
                  transfer_destination: { type: "phone", phone_number: frontDesk },
                  condition: transferConditions.join("; or "),
                  transfer_type: "conference",
                },
              ],
            },
          }
        : null;

    const docs = await db.select().from(knowledgeDocs).where(isNotNull(knowledgeDocs.elevenlabsDocId));
    const knowledgeBase: KnowledgeBaseRef[] = docs.map((d) => ({
      type: "text",
      name: d.title,
      id: d.elevenlabsDocId!,
      usage_mode: "auto",
    }));

    const toolIds = Array.from(new Set([...(currentPrompt.tool_ids ?? []), ...s.toolIds]));

    await patchAgent({
      name: `${s.clinicName} Receptionist – ${s.agentName}`,
      conversation_config: {
        agent: {
          first_message: s.firstMessage,
          prompt: {
            ...currentPrompt,
            prompt: buildPrompt(s),
            tool_ids: toolIds,
            knowledge_base: knowledgeBase,
            built_in_tools: builtIns,
          },
        },
        tts: { ...(agent.conversation_config.tts ?? {}), voice_id: s.voiceId },
      },
    });
    await recordSync(null);
    return { synced: true };
  } catch (err) {
    const error = (err as Error).message;
    console.error("Agent sync failed:", error, (err as { details?: unknown }).details ?? "");
    await recordSync(error);
    return { synced: false, error };
  }
}
