# localRAG (POC)

Notebook LM–style **local RAG** stack: **Next.js** UI, **Node/Fastify** API, **MongoDB Atlas Local** (vector search), **Redis** (24h chat memory), **GitHub Models** via **Microsoft Foundry Inference SDK** (`@azure-rest/ai-inference`). See OpenSpec change `openspec/changes/local-rag/` for full intent.

## Prerequisites

- Node.js 20+
- Docker (for one-command stack)
- A **GitHub token** with permission to call GitHub Models (`GITHUB_TOKEN`)

## Quick start (Docker)

1. Copy env and set your token:

   ```bash
   cp .env.example .env
   # edit .env — set GITHUB_TOKEN
   ```

2. Start MongoDB + Redis + API + web:

   ```bash
   docker compose up --build
   ```

3. **Create the vector search index** (once per empty DB). With compose running:

   ```bash
   MONGODB_URI='mongodb://127.0.0.1:27017/?directConnection=true' MONGODB_DB=localrag npm run create-index -w @local-rag/api
   ```

4. Open **http://localhost:3000** — use the side panel to paste HTML and upload, then chat.

`NEXT_PUBLIC_API_URL` defaults to `http://localhost:3002` for the browser; override in `.env` if you publish the API elsewhere.

## Local development (without Docker for Node apps)

Terminal 1 — MongoDB + Redis (or use compose for just `mongo` + `redis`):

```bash
docker compose up mongo redis
```

Terminal 2 — API:

```bash
cp .env.example .env
npm install
npm run dev:api
```

Terminal 3 — web:

```bash
npm run dev:web
```

Run the **create-index** command (above) against your `MONGODB_URI`.

## Unit tests (no Docker, no live GitHub Models)

```bash
npm test
```

## Workspace layout

| Path        | Role                                      |
| ----------- | ----------------------------------------- |
| `apps/api`  | Fastify REST: `/health`, `/knowledge/*`, `/chat` |
| `apps/web`  | Next.js App Router UI                     |

## Manual smoke (task checklist)

With compose up, index created, and `GITHUB_TOKEN` set: ingest a small HTML snippet in the UI, send a chat message that references its content, and confirm multi-turn memory by asking a follow-up in the same session.
