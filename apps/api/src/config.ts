import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  GITHUB_TOKEN: z.string().min(1).optional(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  INFERENCE_ENDPOINT: z.string().url().default("https://models.github.ai/inference"),
  CHAT_MODEL: z.string().default("openai/o4-mini"),
  EMBEDDING_MODEL: z.string().default("openai/text-embedding-3-small"),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/?directConnection=true"),
  MONGODB_DB: z.string().default("localrag"),
  REDIS_URL: z.string().min(1).default("redis://127.0.0.1:6379"),
  API_PORT: z.coerce.number().default(3002),
  CHUNK_SIZE: z.coerce.number().default(1000),
  CHUNK_OVERLAP: z.coerce.number().default(200),
  MAX_INGEST_BYTES: z.coerce.number().default(1_048_576),
  CHAT_HISTORY_TTL_SECONDS: z.coerce.number().default(86_400),
  CHAT_HISTORY_MAX_MESSAGES: z.coerce.number().default(20),
  VECTOR_INDEX_NAME: z.string().default("vector_index"),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),
  /** Max strings per embeddings API request (GitHub Models caps batch size). */
  EMBEDDING_INPUT_BATCH_MAX: z.coerce.number().default(2048),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  cached = parsed.data;
  return cached;
}

/** Clears parsed config so the next `getConfig()` re-reads `process.env` (tests). */
export function resetConfigCache(): void {
  cached = null;
}

export function requireGithubToken(): string {
  const t = getConfig().GITHUB_TOKEN;
  if (!t) throw new Error("GITHUB_TOKEN is required for inference calls");
  return t;
}
