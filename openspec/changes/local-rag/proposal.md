## Why

Bank-managed desktops often allow only **GitHub Copilot** as an approved path to foundation models, which blocks typical OpenAI/Azure keys and many SaaS RAG stacks. This change defines a **Node.js RAG product** that uses **[GitHub Models](https://github.com/marketplace/models/azure-openai/o4-mini)** (e.g. [o4-mini](https://github.com/marketplace/models/azure-openai/o4-mini) for chat, [text-embedding-3-small](https://github.com/marketplace/models/azure-openai/text-embedding-3-small) for embeddings) as the **sole LLM/embedding gateway**, with retrieval and session state on infrastructure the bank can approve (MongoDB, Redis) and a **Notebook LM–style** experience: curated knowledge, upload, and chat grounded in that knowledge.

## What Changes

- Introduce a **Node.js** backend (TypeScript) that orchestrates RAG with **LangChain** (retrieval, prompts, optional tool-style retrieval similar to the reference n8n agent flow in `eklab-chatbot.json`).
- Use **MongoDB** as the system of record for **knowledge documents** and as the **vector store** (vectors + metadata colocated with source content), replacing the Postgres + Weaviate split in the reference workflow.
- Use **Redis** for **short-term chat / session context** (analogous to n8n’s Redis chat memory keyed by `session_id`), so multi-turn behavior does not depend solely on the model window.
- Add a **Next.js** frontend: **chat UI**, **client-side session id** for multi-turn chat (no user login in **v1** / local POC), and a **side panel for knowledge management** (e.g. paste **raw HTML**, upload → persist in MongoDB → **chunk** → **embed** → write vectors).
- Align **chunking strategy, schema/metadata, and prompting** with patterns from **[EklabDev/vectorclient](https://github.com/EklabDev/vectorclient)** (schemas, knowledge representation, gateway-oriented workflows), adapted to MongoDB + GitHub Models instead of that stack’s Weaviate/API-gateway assumptions.
- **Configuration**: LLM and embedding model IDs should be **switchable** via configuration (defaulting to GitHub Models–compatible model names), without hard-coding a single model.
- Provide a root **`docker-compose.yml`** (and supporting Dockerfiles as needed) so developers can **start the whole stack in one step** (e.g. `docker compose up`): **MongoDB** via official **`mongodb/mongodb-atlas-local`** (Atlas Vector Search locally), **Redis**, API service, and Next.js app, with documented env vars (`GITHUB_TOKEN`, model names, DB/Redis URLs).
- Call GitHub Models using the **Microsoft Foundry Inference SDK** (`@azure-rest/ai-inference`, `@azure/core-auth`) against **`https://models.github.ai/inference`** (see `design.md`); **non-streaming** request–response only for chat and embeddings.
- **Out of scope for this change:** **production hardening** (beyond local POC assumptions) and **streaming** (SSE / token-by-token UI).
- Add **automated unit tests** for deterministic logic (HTML extraction, chunking, validation, error mapping, key/TTL helpers) with **mocked** external I/O (Inference SDK, MongoDB, Redis) where appropriate; a single **`test` / `test:unit`** command runnable in CI without Docker.

No **BREAKING** changes to existing published specs (none exist under `openspec/specs/` today).

## Capabilities

### New Capabilities

- `github-models-llm`: Chat and embedding calls via **Microsoft Foundry Inference SDK** to GitHub Models (`https://models.github.ai/inference`, `GITHUB_TOKEN` as key); configurable chat model (e.g. o4-mini) and embedding model (e.g. text-embedding-3-small); no parallel “shadow” LLM path for the happy path.
- `mongodb-knowledge-store`: MongoDB schemas/collections for source knowledge and vector-indexed chunks (including metadata needed for filtering and provenance); single database role as both knowledge store and vector store.
- `redis-session-context`: Redis-backed session/chat context (keyed by session id), **24-hour TTL**, bounded window of recent turns, integration with the chat pipeline so turns are coherent across requests.
- `knowledge-ingestion`: Ingestion API and processing: accept content such as pasted HTML, normalize/extract text as needed, chunk per agreed rules (informed by vectorclient), embed via `github-models-llm`, upsert into `mongodb-knowledge-store`.
- `rag-chat-pipeline`: LangChain-based orchestration: load session context from Redis, retrieve from MongoDB vector store, assemble prompts, call chat model, return responses; functional parity with the intent of `eklab-chatbot.json` (webhook body: `chat_message`, `session_id`, optional `system_prompt`, collection/knowledge scope) but backed by MongoDB + Redis + GitHub Models.
- `nextjs-web-app`: Next.js application for chat UX, **v1 without user auth** (local POC), client-side session id for chat, and knowledge side panel (list/manage sources, paste HTML and trigger upload through `knowledge-ingestion`).
- `unit-testing`: Automated **unit** test suite and scripts covering pure functions and service modules with mocked boundaries; excludes full-stack E2E unless optionally added later.

### Modified Capabilities

- None (no existing capabilities under `openspec/specs/`).

## Impact

- **New** services and apps: API server (Node), Next.js app, local or bank-hosted **MongoDB** and **Redis**, container or managed offerings as allowed by policy; **Compose-first local bootstrap** via `docker-compose.yml` (single command to run all dependencies + app tiers for dev/demo).
- **Secrets / config**: `GITHUB_TOKEN` for Inference SDK; model names and optional endpoint override via env; **POC retention**: Redis sessions **24h**; MongoDB knowledge **no fixed retention limit** until a later compliance pass.
- **Dependencies**: LangChain (JS), official MongoDB and Redis clients, Next.js; a **test runner** (e.g. Vitest or Jest) for unit tests; operational setup for MongoDB vector search capabilities (product choice to be detailed in `design.md`).
- **Reference assets**: `eklab-chatbot.json` informs **flow** (webhook, Redis memory, vector tool, agent); **[vectorclient](https://github.com/EklabDev/vectorclient)** informs **knowledge/chunking/schema** thinking—not a runtime dependency unless explicitly adopted in design.
