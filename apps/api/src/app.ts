import cors from "@fastify/cors";
import Fastify from "fastify";
import { Redis } from "ioredis";
import { MongoClient } from "mongodb";
import { getConfig } from "./config.js";
import { sendMappedError } from "./http/mapError.js";
import { KnowledgeRepository } from "./mongo/knowledgeRepository.js";
import { RedisChatHistoryStore } from "./redis/chatHistory.js";
import { ingestHtml } from "./services/ingestService.js";
import { buildChatChain, runChat } from "./services/ragChatService.js";

export type AppDeps = {
  mongo: MongoClient;
  redis: Redis;
  repo: KnowledgeRepository;
  history: RedisChatHistoryStore;
};

export async function createApp(deps: AppDeps) {
  const cfg = getConfig();
  const app = Fastify({ logger: { level: cfg.LOG_LEVEL } });
  await app.register(cors, { origin: true });

  const chain = buildChatChain(deps.repo, deps.history);

  app.setErrorHandler(async (err, req, reply) => {
    req.log.error({ err }, "unhandled_error");
    return sendMappedError(reply, err);
  });

  app.get("/health", async () => ({ ok: true }));

  app.post("/knowledge/ingest", async (req, reply) => {
    const body = req.body as {
      html?: string;
      user_id?: string;
      title?: string;
      schema_id?: string;
    };
    if (!body?.html || typeof body.html !== "string") {
      return reply.status(400).send({ error: "html is required" });
    }
    if (!body.user_id || typeof body.user_id !== "string") {
      return reply.status(400).send({ error: "user_id is required" });
    }
    try {
      const res = await ingestHtml(deps.repo, {
        html: body.html,
        userId: body.user_id,
        title: body.title,
        schemaId: body.schema_id,
      });
      return reply.send(res);
    } catch (e) {
      req.log.error({ err: e }, "knowledge_ingest_failed");
      return sendMappedError(reply, e);
    }
  });

  app.get("/knowledge/sources", async (req, reply) => {
    const q = req.query as { user_id?: string };
    if (!q.user_id) {
      return reply.status(400).send({ error: "user_id query param is required" });
    }
    const list = await deps.repo.listSources(q.user_id);
    return reply.send({ sources: list });
  });

  app.delete("/knowledge/sources/:id", async (req, reply) => {
    const p = req.params as { id: string };
    const q = req.query as { user_id?: string };
    if (!q.user_id) {
      return reply.status(400).send({ error: "user_id query param is required" });
    }
    const ok = await deps.repo.deleteSource(p.id, q.user_id);
    if (!ok) return reply.status(404).send({ error: "Not found" });
    return reply.send({ ok: true });
  });

  app.post("/chat", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const chat_message = body.chat_message;
    const session_id = body.session_id;
    const user_id = body.user_id;
    if (typeof chat_message !== "string" || !chat_message.trim()) {
      return reply.status(400).send({ error: "chat_message is required" });
    }
    if (typeof session_id !== "string" || !session_id.trim()) {
      return reply.status(400).send({ error: "session_id is required" });
    }
    if (typeof user_id !== "string" || !user_id.trim()) {
      return reply.status(400).send({ error: "user_id is required" });
    }
    try {
      const res = await runChat(chain, deps.repo, deps.history, {
        chat_message,
        session_id,
        system_prompt:
          typeof body.system_prompt === "string" ? body.system_prompt : undefined,
        user_id,
        schema_id: typeof body.schema_id === "string" ? body.schema_id : undefined,
        knowledge_source_id:
          typeof body.knowledge_source_id === "string"
            ? body.knowledge_source_id
            : undefined,
        weaviate_collection_id:
          typeof body.weaviate_collection_id === "string"
            ? body.weaviate_collection_id
            : undefined,
        vector_search_only: body.vector_search_only === true,
      });
      return reply.send(res);
    } catch (e) {
      req.log.error(
        {
          err: e,
          session_id,
          user_id,
        },
        "chat_failed",
      );
      return sendMappedError(reply, e);
    }
  });

  return app;
}

export async function connectDeps(): Promise<AppDeps> {
  const cfg = getConfig();
  const mongo = new MongoClient(cfg.MONGODB_URI);
  await mongo.connect();
  const redis = new Redis(cfg.REDIS_URL);
  const repo = KnowledgeRepository.fromDb(mongo.db(cfg.MONGODB_DB));
  const history = new RedisChatHistoryStore(redis);
  return { mongo, redis, repo, history };
}
