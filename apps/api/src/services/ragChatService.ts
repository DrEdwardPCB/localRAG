import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { getConfig } from "../config.js";
import {
  chatComplete,
  embedTexts,
  type ChatMessage,
} from "../inference/githubModels.js";
import type { KnowledgeRepository } from "../mongo/knowledgeRepository.js";
import type { RedisChatHistoryStore } from "../redis/chatHistory.js";

export type VectorHit = {
  text: string;
  score: number;
  knowledgeSourceId: string;
};

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
  /**
   * When true: run embedding + vector search only (no LLM, no Redis read/write for history).
   * Use to validate retrieval.
   */
  vector_search_only?: boolean;
};

type ChainState = {
  body: ChatBody;
  history: { role: "user" | "assistant"; content: string }[];
  hits: VectorHit[];
  contextText: string;
  schemaText: string | null;
  answer: string;
};

export async function loadRetrievalState(
  repo: KnowledgeRepository,
  historyStore: RedisChatHistoryStore,
  body: ChatBody,
  options: { loadHistory: boolean },
): Promise<ChainState> {
  const cfg = getConfig();
  const history = options.loadHistory
    ? await historyStore.load(body.session_id, cfg.CHAT_HISTORY_MAX_MESSAGES)
    : [];
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
  return { body, history, hits, contextText, schemaText, answer: "" };
}

export function buildChatChain(
  repo: KnowledgeRepository,
  historyStore: RedisChatHistoryStore,
) {
  const loadContext = RunnableLambda.from(async (body: ChatBody): Promise<ChainState> => {
    return loadRetrievalState(repo, historyStore, body, { loadHistory: true });
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

export type ChatResponse =
  | { mode: "chat"; reply: string }
  | {
      mode: "vector_search_only";
      hits: VectorHit[];
      contextText: string;
      schemaText: string | null;
    };

export async function runChat(
  chain: ReturnType<typeof buildChatChain>,
  repo: KnowledgeRepository,
  historyStore: RedisChatHistoryStore,
  body: ChatBody,
): Promise<ChatResponse> {
  if (body.vector_search_only) {
    const state = await loadRetrievalState(repo, historyStore, body, {
      loadHistory: false,
    });
    return {
      mode: "vector_search_only",
      hits: state.hits,
      contextText: state.contextText,
      schemaText: state.schemaText,
    };
  }

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
  return { mode: "chat", reply: state.answer };
}
