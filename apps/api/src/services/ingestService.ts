import { getConfig } from "../config.js";
import { chunkText } from "../chunk/recursiveChunk.js";
import { extractTextFromHtml } from "../html/extractTextFromHtml.js";
import { embedTexts } from "../inference/githubModels.js";
import type { KnowledgeRepository } from "../mongo/knowledgeRepository.js";

export type IngestInput = {
  html: string;
  userId: string;
  title?: string;
  schemaId?: string;
};

export async function ingestHtml(
  repo: KnowledgeRepository,
  input: IngestInput,
): Promise<{ sourceId: string; chunkCount: number }> {
  const cfg = getConfig();
  if (Buffer.byteLength(input.html, "utf8") > cfg.MAX_INGEST_BYTES) {
    const err = new Error("Payload exceeds MAX_INGEST_BYTES");
    (err as Error & { code?: string }).code = "PAYLOAD_TOO_LARGE";
    throw err;
  }

  const text = extractTextFromHtml(input.html);
  if (!text) {
    const err = new Error("No extractable text from HTML");
    (err as Error & { code?: string }).code = "EMPTY_CONTENT";
    throw err;
  }

  const pieces = await chunkText(text, cfg.CHUNK_SIZE, cfg.CHUNK_OVERLAP);
  if (!pieces.length) {
    const err = new Error("Chunking produced no segments");
    (err as Error & { code?: string }).code = "EMPTY_CONTENT";
    throw err;
  }

  const embeddings = await embedTexts(pieces);
  if (embeddings.length !== pieces.length) {
    throw new Error("Embedding count mismatch");
  }

  const sourceId = await repo.insertSource({
    userId: input.userId,
    schemaId: input.schemaId,
    title: input.title,
    rawHtml: input.html,
    createdAt: new Date(),
  });
  const sid = sourceId.toHexString();

  const chunkDocs = pieces.map((t, i) => ({
    knowledgeSourceId: sid,
    userId: input.userId,
    schemaId: input.schemaId,
    chunkIndex: i,
    text: t,
    embedding: embeddings[i]!,
  }));

  await repo.insertChunks(chunkDocs);
  return { sourceId: sid, chunkCount: pieces.length };
}
