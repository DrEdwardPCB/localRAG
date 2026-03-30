## 1. Monorepo and tooling

- [x] 1.1 Scaffold `apps/api` and `apps/web` (TypeScript, shared root package manager choice documented in README)
- [x] 1.2 Add workspace scripts to run API and web in dev
- [x] 1.3 Add `.env.example` at repo root with `GITHUB_TOKEN`, `MONGODB_URI`, `REDIS_URL`, `CHAT_MODEL`, `EMBEDDING_MODEL`, `INFERENCE_ENDPOINT`, `NEXT_PUBLIC_API_URL`
- [x] 1.4 Add **Vitest** or **Jest** to `apps/api`, root workspace `test` script, and document how to run unit tests in README

## 2. Docker Compose

- [x] 2.1 Add root `docker-compose.yml` with `mongodb/mongodb-atlas-local` (pinned tag), `redis`, `api`, `web`, shared network, healthchecks, `depends_on`
- [x] 2.2 Add Dockerfiles for `api` and `web` suitable for local `docker compose up --build`
- [x] 2.3 Document one-command startup and required host env (e.g. `GITHUB_TOKEN`) in README

## 3. MongoDB knowledge store

- [x] 3.1 Define collections/schemas for knowledge sources and chunks (embedding field, metadata, indexes)
- [x] 3.2 Add init/migration script to create Atlas Vector Search index compatible with `mongodb/mongodb-atlas-local`
- [x] 3.3 Implement data access helpers for insert chunks, delete source + chunks, and vector search with scope filters

## 4. Redis session context

- [x] 4.1 Configure `ioredis` client and key naming for chat memory per `session_id`
- [x] 4.2 Implement 24-hour TTL policy and bounded message window per `design.md`
- [x] 4.3 Integrate with LangChain Redis chat memory (or equivalent adapter); add **unit tests** with mocked Redis client for key pattern and TTL policy

## 5. GitHub Models (Inference SDK)

- [x] 5.1 Add `@azure-rest/ai-inference` and `@azure/core-auth`; implement shared `ModelClient` wrapper with `AzureKeyCredential` and `isUnexpected` error handling
- [x] 5.2 Implement non-streaming `embeddings` helper (batch input, model from env)
- [x] 5.3 Implement non-streaming chat completion helper (model from env, full assistant text return)
- [x] 5.4 Add **unit tests** for Inference wrapper success and `isUnexpected` error paths using mocked SDK responses

## 6. Knowledge ingestion API

- [x] 6.1 Implement `POST /knowledge/ingest` (HTML body + metadata); cheerio/jsdom text extraction; script stripping; max-size validation; **unit tests** for extract + size validation fixtures
- [x] 6.2 Wire chunking (size/overlap from config), embedding calls, and MongoDB upsert; **unit tests** for chunk boundaries/overlap with mocked embedder and DB
- [x] 6.3 Implement `GET /knowledge/sources` and `DELETE /knowledge/sources/:id` with scoped listing as needed for POC

## 7. RAG chat pipeline

- [x] 7.1 Implement `POST /chat` accepting `chat_message`, `session_id`, optional `system_prompt`, `user_id`, `schema_id`, and knowledge scope field per spec
- [x] 7.2 Build LangChain chain: Redis history → query embed → MongoDB vector retrieve → optional schema metadata load → chat completion → persist assistant to Redis
- [x] 7.3 Return JSON response only (no SSE); map Inference and DB errors to HTTP status and safe error bodies; **unit tests** for error mapping and happy-path handler wiring with mocks

## 8. Next.js web app

- [x] 8.1 Chat page with `session_id` in `sessionStorage` and non-streaming message send to API
- [x] 8.2 Knowledge side panel: paste HTML, upload, list sources, delete source; use `NEXT_PUBLIC_API_URL`
- [x] 8.3 Ensure no `GITHUB_TOKEN` or secrets in client bundles (server-side proxy or API-only calls as needed)

## 9. Verification

- [x] 9.1 Manual smoke: `docker compose up`, ingest sample HTML, multi-turn chat grounded in chunks
- [x] 9.2 Ensure **`test` / unit** command passes in CI-friendly mode (no compose, no live GitHub Models) per `specs/unit-testing/spec.md`

## 10. Unit testing (cross-cutting)

- [x] 10.1 Add shared **test fixtures** (sample HTML, oversized payload) under `apps/api` or `packages/shared` as appropriate
- [x] 10.2 Optional: **Vitest** coverage for critical **Next.js** pure utilities only; UI E2E remains out of scope for POC unless explicitly added later
