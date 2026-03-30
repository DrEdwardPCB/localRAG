## Context

The **local-rag** proposal targets bank desktops where **GitHub Copilot** is the practical route to models, so **chat and embeddings** go through **[GitHub Models](https://github.com/marketplace/models/azure-openai/o4-mini)** (e.g. [o4-mini](https://github.com/marketplace/models/azure-openai/o4-mini), [text-embedding-3-small](https://github.com/marketplace/models/azure-openai/text-embedding-3-small)). The system is **Node.js/TypeScript** end-to-end: a **Next.js** app for Notebook LM–style UX, a **backend API** for ingestion and RAG, **MongoDB** for canonical knowledge + vectors, **Redis** for conversational memory, **LangChain** for orchestration, and **docker-compose** for one-command local stack startup.

The reference **n8n** workflow (`eklab-chatbot.json`) shows the intended **runtime shape**: webhook JSON with `chat_message`, `session_id`, optional `system_prompt`, plus **scope** fields (`user_id`, `schema_id`, `weaviate_collection_id` in the reference). Postgres + Weaviate there map here to **MongoDB** (schema/knowledge metadata + chunks + embeddings) and **GitHub Models** for LLM/embeddings. **[vectorclient](https://github.com/EklabDev/vectorclient)** informs **knowledge modeling, chunking discipline, and schema-oriented** thinking—not a mandatory runtime fork unless we explicitly reuse code.

## Goals / Non-Goals

**Goals:**

- Single **docker compose** command brings up **MongoDB, Redis, API, and Next.js** for dev/demo, with env-driven GitHub Models and connection strings.
- **RAG path**: Redis-backed chat history + retrieval from MongoDB vectors + GitHub Models chat completion, implemented with **LangChain (JS)**.
- **Ingestion path**: raw HTML (or similar) → extract text → chunk → embed (same gateway) → upsert into MongoDB.
- **Configurable models** for chat and embeddings via environment (switchable without code changes).
- **API contract** aligned with the **spirit** of `eklab-chatbot.json` (session id, message, system prompt, tenant/knowledge scope) so integrations can migrate conceptually from n8n.
- **Chat UX (POC):** **Request–response only**—full assistant message returned when the model finishes; **no streaming** of tokens.
- **Automated unit tests** for deterministic code paths, with **mocked** GitHub Models client, MongoDB, and Redis in unit scope; runnable via one workspace command without requiring `docker compose up`.

**Non-Goals:**

- **Production hardening** for this change (auth beyond POC assumptions, hardening runbooks, backup/DR, WAF, rate limiting at the edge, SOC-style monitoring, etc.)—explicitly **out of scope**; treat as a future change if needed.
- **Streaming** chat completions (SSE, `@azure/core-sse`, incremental UI)—not required for POC; non-streaming Inference SDK calls are sufficient.
- Supporting **n8n** as a required runtime component for the shipped product.
- **Postgres / Weaviate** as first-class stores (reference only).
- **Multipart file upload** as the primary ingestion path in v1 (HTML paste / text-first as in proposal; files can be a later extension).
- **Guaranteed air-gapped** operation without any GitHub network egress (bank policy may still allow GitHub Models; offline LLM is out of scope unless a later change adds it).

## Decisions

### 1. Repository and service layout

- **Decision:** **Monorepo** with two runnable apps: `apps/api` (Fastify or Express—pick one and stay consistent) and `apps/web` (Next.js App Router). Shared types (DTOs, zod schemas) live in `packages/shared` only if duplication becomes painful; start minimal.
- **Alternatives:** Separate repos (more overhead for compose and versioning); single Next.js app with all API in Route Handlers (simpler deploy, weaker separation for long-running ingestion jobs—acceptable for v1 if we defer heavy queues).

### 2. GitHub Models via Microsoft Foundry Inference SDK

- **Decision:** Call **GitHub Models** through the **[Microsoft Foundry Inference SDK](https://www.npmjs.com/package/@azure-rest/ai-inference)** (REST client), not ad-hoc `fetch`. Dependencies for POC: **`@azure-rest/ai-inference`**, **`@azure/core-auth`**. **Do not** add **`@azure/core-sse`** or streaming APIs for this POC—use **non-streaming** chat and embedding calls only.
- **Endpoint:** `https://models.github.ai/inference` (configurable via env if GitHub changes the host).
- **Credential:** `AzureKeyCredential(process.env.GITHUB_TOKEN)` — the GitHub token is treated as the API key for this endpoint (same pattern as Microsoft’s GitHub Models samples).
- **Embeddings:** `ModelClient(endpoint, new AzureKeyCredential(token))` then `client.path("/embeddings").post({ body: { input: string | string[], model: modelName } })`; handle failures with `isUnexpected(response)` and surface `response.body.error`.
- **Chat completions:** Use the same client and endpoint with the SDK’s **chat/completions**-style path (same base URL; model name from env, e.g. `openai/o4-mini` or marketplace-aligned id). Use the **single-shot response** (no stream); return the full assistant text to the API caller. Exact path/method follows the SDK + GitHub Models docs; keep a **single module** wrapping both embeddings and chat so LangChain (or a thin adapter) does not scatter raw HTTP.
- **Model IDs:** Continue to load **chat** and **embedding** model names from environment (e.g. `openai/text-embedding-3-small`, `openai/o4-mini`) so they remain switchable without code changes.
- **LangChain:** Prefer **custom wrappers** or LangChain callables that delegate to this client if stock `ChatOpenAI` / `OpenAIEmbeddings` do not match the Inference SDK contract; avoid duplicating auth or base URL logic.
- **Alternatives:** Raw `fetch` only (more error-prone); generic OpenAI SDK pointed at GitHub (may drift from Foundry Inference API); local Ollama (non-goal for this change).

### 3. MongoDB for documents + vectors

- **Decision:** Store **source documents** (metadata + optional raw HTML reference) and **chunk documents** with an **`embedding` vector** plus metadata (`knowledgeSourceId`, `chunkIndex`, `text`, timestamps, `userId` / tenant fields as needed). Retrieval uses **Atlas Vector Search** (`$vectorSearch`).
- **Local / compose:** Use the official **`mongodb/mongodb-atlas-local`** image ([Docker Hub: `mongodb/mongodb-atlas-local`](https://hub.docker.com/r/mongodb/mongodb-atlas-local)) so local dev matches **Atlas Vector Search** behavior in one container (single-node replica set, Vector Search supported). Wire `MONGODB_URI` in compose (e.g. `directConnection=true` as in MongoDB docs). Pin a **specific tag** (e.g. `8.0` or a dated build) in `docker-compose.yml` for reproducibility.
- **Indexes:** Collection names and **vector search indexes** are created via migration/init script documented in the repo.
- **Alternatives:** Plain `mongo` community image without Atlas Local (often **no** `$vectorSearch` parity—rejected for this POC); separate vector DB (contradicts proposal).

### 4. Redis session / chat memory

- **Decision:** **Redis** stores **LangChain-compatible chat message history** keyed by **`session_id`** (from client), with a **max message count** analogous to n8n’s `contextWindowLength` (e.g. last N turns). Use **`ioredis`**; wrap with LangChain’s Redis-backed memory abstraction or an equivalent thin adapter.
- **Retention:** Set **TTL to 24 hours** on session/chat keys (or refresh TTL on each message so idle sessions expire after 24h—pick one policy in implementation and document it). POC assumption: ephemeral chat memory only.
- **Alternatives:** MongoDB-only sessions (heavier writes); stateless single-turn only (poor UX).

### 5. LangChain orchestration shape

- **Decision:** Implement **retrieval-augmented** generation as: load history from Redis → **embed query** (same embedding model) → **vector search** in MongoDB scoped by **knowledge base / tenant** → build prompt with retrieved chunks + optional **Postgres-style “schema” row** equivalent stored in MongoDB (metadata document keyed by `schema_id`) → call chat model → persist assistant message to Redis → return JSON response.
- **Optional tool-style retrieval** (like n8n’s “retrieve-as-tool”) is acceptable if it matches LangChain patterns; default to **single retrieval pass** for predictability unless we need agentic behavior.
- **Alternatives:** Raw SDK-only (more boilerplate); Python sidecar (violates Node-first).

### 6. Ingestion and HTML handling

- **Decision:** **Server-side** pipeline: accept **raw HTML** (string) + metadata (title, `user_id` / owner, optional `schema_id` or knowledge base id) → **sanitize/extract text** (e.g. **cheerio** or **jsdom**) → **chunk** (e.g. recursive character splitter with overlap; sizes configurable) → **embed** batches → **bulk write** chunks. Align **metadata richness** (provenance, version) with ideas from **vectorclient** without copying unused concepts.
- **Alternatives:** Store HTML only without chunking (breaks RAG); client-side chunking (untrusted, inconsistent).

### 7. Next.js UX and auth (v1)

- **Decision:** **App Router** with a **chat page** and a **collapsible side panel** for knowledge: paste HTML, submit to ingestion API, list/delete sources. **Session id** generated client-side (UUID) and stored in **sessionStorage** (or similar) for chat continuity; **no user login, no API auth** in v1—the stack is **local POC only** (compose on a trusted machine). **No model keys or `GITHUB_TOKEN` in the browser**; only the backend holds tokens and calls the Inference SDK.
- **Later:** If the product leaves pure local demo, add **auth** (e.g. SSO, API keys) and then revisit “session token refresh” for real user sessions.
- **Alternatives:** Full auth in v1—explicitly **out of scope** for this POC.

### 8. Docker Compose

- **Decision:** Root **`docker-compose.yml`** defines **`mongo`** (`mongodb/mongodb-atlas-local`), **`redis`**, **`api`**, **`web`** with **shared network**, **healthchecks** where applicable, **`depends_on`**, and **`.env.example`** listing `MONGODB_URI`, `REDIS_URL`, `GITHUB_TOKEN`, chat/embedding model env vars, and public `NEXT_PUBLIC_API_URL`. **One command:** `docker compose up --build`.
- **Alternatives:** `docker compose` only for infra + run Node on host (split workflow; worse “one click” story).

### 9. API surface (high level)

- **Decision:** Expose **REST** (or tRPC only if team standard—default REST for simplicity) on the API service: **`POST /chat`** (body compatible with reference fields: `chat_message`, `session_id`, optional `system_prompt`, `user_id`, `schema_id`, knowledge/`collection` scope), **`POST /knowledge/ingest`**, **`GET /knowledge/sources`**, **`DELETE /knowledge/sources/:id`** (exact paths finalized in specs/tasks). Responses are **JSON request–response** end-to-end (no SSE). Next.js calls API server-side or via BFF to avoid CORS and key leakage.

### 10. Unit testing

- **Decision:** Use **Vitest** (preferred for Vite/TS monorepos) or **Jest** consistently in `apps/api` (and `apps/web` for pure utilities/components if any). **Unit tests** target pure functions and thin modules: HTML-to-text extraction, chunking parameters, request validation, Redis key/TTL helpers, HTTP error mapping, and Inference SDK wrapper behavior using **mocked** `@azure-rest/ai-inference` responses. **Integration tests** against real MongoDB/Redis in Docker are optional for POC; the default **`pnpm test` / `npm test`** (or documented equivalent) SHALL pass **offline of compose** with mocks.
- **Alternatives:** E2E-only testing (slow, flaky for POC); hitting live GitHub Models in CI (cost, secret management—avoid for unit scope).

## Risks / Trade-offs

- **[Risk] GitHub Models availability or policy change** → Mitigation: abstract provider behind one module; all model IDs in config; document fallback options as future change only.
- **[Risk] MongoDB Vector Search not available in pure local container** → Mitigation: use **`mongodb/mongodb-atlas-local`** in compose; fail fast in startup checks if the vector index is missing.
- **[Risk] HTML ingestion XSS or SSRF if URLs are fetched** → Mitigation: v1 **does not** fetch remote URLs from pasted HTML unless explicitly added; strip scripts; treat content as data, not executable.
- **[Risk] Embedding cost/latency on large pastes** → Mitigation: async ingestion job (in-process queue v1; Redis/BullMQ later if needed), chunk batching, max document size limits.
- **[Risk] Redis data loss** → Mitigation: acceptable for **ephemeral chat**; **24-hour TTL** on session keys (see §4); not a durable archive.

## Migration Plan

1. Land **compose + skeleton** API and web with health endpoints and DB connectivity.
2. Add **MongoDB** collections and **vector index** creation path; seed script optional.
3. Wire **ingestion** then **chat/RAG**; point Next.js UI at API.
4. **Beyond POC:** Bank deployment, hardening, and streaming UX are **out of scope** for this change—handle in separate work if required.

## Data retention (POC)

- **Redis:** **24 hours** TTL on chat/session keys (see §4).
- **MongoDB:** **No special retention limit** for v1/POC—knowledge sources and chunks persist until explicitly deleted via product behavior or manual DB cleanup.

## Open Questions

- **None** for this POC scope (non-streaming chat, no production hardening in this change).
