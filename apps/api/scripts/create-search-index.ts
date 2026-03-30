/**
 * Create Atlas Vector Search index on `knowledge_chunks` (run once per environment).
 * Usage: MONGODB_URI=... MONGODB_DB=localrag npm run create-index -w @local-rag/api
 */
import { config as loadEnv } from "dotenv";
import { MongoClient } from "mongodb";
import { z } from "zod";

loadEnv();

const env = z
  .object({
    MONGODB_URI: z.string().min(1),
    MONGODB_DB: z.string().default("localrag"),
    VECTOR_INDEX_NAME: z.string().default("vector_index"),
    EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),
  })
  .parse(process.env);

async function main() {
  const client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  const col = client.db(env.MONGODB_DB).collection("knowledge_chunks");

  const definition = {
    fields: [
      {
        type: "vector",
        path: "embedding",
        numDimensions: env.EMBEDDING_DIMENSIONS,
        similarity: "cosine",
      },
      { type: "filter", path: "userId" },
      { type: "filter", path: "knowledgeSourceId" },
      { type: "filter", path: "schemaId" },
    ],
  };

  await col.createSearchIndex({
    name: env.VECTOR_INDEX_NAME,
    type: "vectorSearch",
    definition,
  });

  console.log(`Created search index "${env.VECTOR_INDEX_NAME}" on knowledge_chunks`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
