import "server-only";
import type { User } from "@/lib/auth/users";
import { listKnowledgeBases } from "@/lib/knowledge";
import { defaultModelKey, listModelOptions } from "@/lib/providers/registry";
import type { ChatRow } from "./store";
import type { KnowledgeScope } from "./types";

/** Everything the chat view needs besides the messages. */
export async function chatPageData(user: User, chat?: ChatRow | null) {
  const [models, fallback, kbs] = await Promise.all([
    listModelOptions(),
    defaultModelKey(),
    listKnowledgeBases(user),
  ]);

  const initialModel = chat && models.some((m) => m.key === chat.model_key) ? chat.model_key : fallback;

  let initialKnowledge: KnowledgeScope;
  if (chat && chat.knowledge_scope === "kb" && kbs.some((k) => k.id === chat.knowledge_base_id)) {
    initialKnowledge = { scope: "kb", kbId: chat.knowledge_base_id! };
  } else if (chat && chat.knowledge_scope !== "kb") {
    initialKnowledge = { scope: chat.knowledge_scope };
  } else {
    // New chats search company knowledge by default once there is some.
    initialKnowledge = { scope: kbs.some((k) => k.ready_count > 0) ? "all" : "none" };
  }

  return {
    models,
    initialModel,
    knowledgeOptions: kbs.map((k) => ({ id: k.id, name: k.name, visibility: k.visibility })),
    initialKnowledge,
  };
}
