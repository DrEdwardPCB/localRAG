import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { getConfig } from "../config.js";
import {
  chatComplete,
  embedTexts,
  type ChatMessage,
} from "../inference/githubModels.js";
import type { KnowledgeRepository } from "../mongo/knowledgeRepository.js";
import type { RedisChatHistoryStore } from "../redis/chatHistory.js";

export type ChatBody = {
  chat_message: string;
  session_id: string;
  system_prompt?: string;
  user_id: string;
  schema_id?: string;
  /** Preferred knowledge filter */
  knowledge_source_id?: string;
  /** Legacy / n8n-style alias */
  weaviate_collection_id?: string;
};

type ChainState = {
  body: ChatBody;
  history: { role: "user" | "assistant"; content: string }[];
  contextText: string;
  schemaText: string | null;
  answer: string;
};

export function buildChatChain(
  repo: KnowledgeRepository,
  historyStore: RedisChatHistoryStore,
) {
  const loadContext = RunnableLambda.from(async (body: ChatBody): Promise<ChainState> => {
    const cfg = getConfig();
    const history = await historyStore.load(body.session_id, cfg.CHAT_HISTORY_MAX_MESSAGES);
    const [qEmb] = await embedTexts([body.chat_message]);
    const sourceScope =
      body.knowledge_source_id ?? body.weaviate_collection_id ?? undefined;
    const hits = await repo.vectorSearch({
      embedding: qEmb,
      userId: body.user_id,
      knowledgeSourceId: sourceScope,
      limit: 4,
    });
    const contextText = hits.map((h) => h.text).join("\n\n---\n\n");
    let schemaText: string | null = null;
    if (body.schema_id) {
      schemaText = await repo.getSchemaMetadata(body.schema_id, body.user_id);
    }
    return { body, history, contextText, schemaText, answer: "" };
  });

  const generate = RunnableLambda.from(async (state: ChainState): Promise<ChainState> => {
    const defaultSystem =
      "You are a helpful assistant. Use the provided context when relevant; if context is insufficient, say so.";
    const sysParts = [bodySystem(state.body, defaultSystem)];
    if (state.schemaText) {
      sysParts.push(`Reference schema notes:\n${state.schemaText}`);
    }
    if (state.contextText) {
      sysParts.push(`Context from knowledge base:\n${state.contextText}`);
    }
    const systemContent = sysParts.join("\n\n");

    const messages: ChatMessage[] = [{ role: "system", content: systemContent }];
    for (const t of state.history) {
      messages.push({
        role: t.role === "user" ? "user" : "assistant",
        content: t.content,
      });
    }
    messages.push({ role: "user", content: state.body.chat_message });

    const answer = await chatComplete(messages);
    return { ...state, answer };
  });

  return RunnableSequence.from([loadContext, generate]);
}

function bodySystem(body: ChatBody, fallback: string): string {
  return (body.system_prompt && body.system_prompt.trim()) || fallback;
}

export async function runChat(
  chain: ReturnType<typeof buildChatChain>,
  historyStore: RedisChatHistoryStore,
  body: ChatBody,
): Promise<{ reply: string }> {
  const cfg = getConfig();
  const state = await chain.invoke(body);
  await historyStore.append(
    body.session_id,
    { role: "user", content: body.chat_message },
    cfg.CHAT_HISTORY_MAX_MESSAGES,
  );
  await historyStore.append(
    body.session_id,
    { role: "assistant", content: state.answer },
    cfg.CHAT_HISTORY_MAX_MESSAGES,
  );
  return { reply: state.answer };
}
