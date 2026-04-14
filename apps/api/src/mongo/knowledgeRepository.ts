import {
  type Collection,
  type Db,
  MongoClient,
  ObjectId,
} from "mongodb";
import { getConfig } from "../config.js";
import type { KnowledgeChunkDoc, KnowledgeSourceDoc, SchemaMetadataDoc } from "./types.js";

const SOURCES = "knowledge_sources";
const CHUNKS = "knowledge_chunks";
const SCHEMAS = "schema_metadata";

export class KnowledgeRepository {
  constructor(
    private readonly db: Db,
    private readonly vectorIndexName: string,
  ) {}

  static async connect(uri: string, dbName: string): Promise<KnowledgeRepository> {
    const client = new MongoClient(uri);
    await client.connect();
    const cfg = getConfig();
    const db = client.db(dbName);
    return new KnowledgeRepository(db, cfg.VECTOR_INDEX_NAME);
  }

  /** Use pre-connected db (e.g. app singleton) */
  static fromDb(db: Db): KnowledgeRepository {
    return new KnowledgeRepository(db, getConfig().VECTOR_INDEX_NAME);
  }

  private sources(): Collection<KnowledgeSourceDoc> {
    return this.db.collection<KnowledgeSourceDoc>(SOURCES);
  }

  private chunks(): Collection<KnowledgeChunkDoc> {
    return this.db.collection<KnowledgeChunkDoc>(CHUNKS);
  }

  private schemas(): Collection<SchemaMetadataDoc> {
    return this.db.collection<SchemaMetadataDoc>(SCHEMAS);
  }

  async insertSource(doc: Omit<KnowledgeSourceDoc, "_id">): Promise<ObjectId> {
    const res = await this.sources().insertOne(doc);
    return res.insertedId;
  }

  async insertChunks(docs: Omit<KnowledgeChunkDoc, "_id">[]): Promise<void> {
    if (!docs.length) return;
    await this.chunks().insertMany(docs);
  }

  /** Distinct `userId` values that have at least one knowledge source. */
  async listDistinctUserIds(): Promise<string[]> {
    const raw = await this.sources().distinct("userId");
    return (raw as unknown[])
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .sort((a, b) => a.localeCompare(b));
  }

  async listSources(userId: string): Promise<
    { id: string; title?: string; createdAt: Date; schemaId?: string }[]
  > {
    const cur = this.sources()
      .find({ userId })
      .sort({ createdAt: -1 })
      .project({ title: 1, createdAt: 1, schemaId: 1 });
    const rows = await cur.toArray();
    return rows.map((r) => ({
      id: r._id!.toHexString(),
      title: r.title,
      createdAt: r.createdAt,
      schemaId: r.schemaId,
    }));
  }

  async deleteSource(sourceId: string, userId: string): Promise<boolean> {
    const oid = new ObjectId(sourceId);
    const del = await this.sources().deleteOne({ _id: oid, userId });
    if (del.deletedCount === 0) return false;
    await this.chunks().deleteMany({ knowledgeSourceId: sourceId, userId });
    return true;
  }

  async vectorSearch(params: {
    embedding: number[];
    userId: string;
    knowledgeSourceId?: string;
    limit: number;
  }): Promise<{ text: string; score: number; knowledgeSourceId: string }[]> {
    const col = this.chunks();
    const filter: Record<string, unknown> = { userId: params.userId };
    if (params.knowledgeSourceId) {
      filter.knowledgeSourceId = params.knowledgeSourceId;
    }
    const vectorSearchDebug = true;
    if (vectorSearchDebug) {
      try {
        const indexes = await col.listSearchIndexes().toArray();
        console.log(
          "[vectorSearch debug] 1. listSearchIndexes → look for status READY, type vectorSearch:",
          JSON.stringify(indexes, null, 2),
        );
      } catch (e) {
        console.log("[vectorSearch debug] 1. listSearchIndexes failed:", e);
      }
      console.log(
        "[vectorSearch debug] 2. index name used (must match Atlas):",
        this.vectorIndexName,
      );
      const sampleDoc =
        (await col.findOne({ userId: params.userId })) ?? (await col.findOne({}));
      console.log(
        "[vectorSearch debug] 3. stored embedding length (sample doc):",
        sampleDoc?.embedding?.length ?? "(no document)",
      );
      console.log("[vectorSearch debug] 3. query embedding length:", params.embedding.length);
      console.log(
        "[vectorSearch debug] 4. db:",
        this.db.databaseName,
        "collection:",
        col.collectionName,
      );
      const emb = params.embedding;
      console.log("[vectorSearch debug] 5. query vector is array:", Array.isArray(emb));
      console.log(
        "[vectorSearch debug] 5. query vector first elem type:",
        emb.length ? typeof emb[0] : "(empty)",
      );
      console.log(
        "[vectorSearch debug] 5. query vector any nullish:",
        emb.some((x) => x == null),
      );
      console.log("[vectorSearch debug] filter used in $vectorSearch:", filter);
    }
    const pipeline = [
      {
        $vectorSearch: {
          index: this.vectorIndexName,
          path: "embedding",
          queryVector: params.embedding,
          numCandidates: Math.max(params.limit * 10, 50),
          limit: params.limit,
          filter,
        },
      },
      {
        $project: {
          text: 1,
          knowledgeSourceId: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];
    const rows = await col.aggregate(pipeline).toArray();
    if (vectorSearchDebug) {
      console.log("[vectorSearch debug] aggregate result count:", rows.length);
    }
    return rows.map((r) => ({
      text: String(r.text),
      score: Number(r.score ?? 0),
      knowledgeSourceId: String(r.knowledgeSourceId),
    }));
  }

  async getSchemaMetadata(schemaId: string, userId: string): Promise<string | null> {
    const doc = await this.schemas().findOne({ schemaId, userId });
    return doc?.content ?? null;
  }

  async upsertSchemaMetadata(
    schemaId: string,
    userId: string,
    content: string,
  ): Promise<void> {
    await this.schemas().updateOne(
      { schemaId, userId },
      { $set: { content, updatedAt: new Date() }, $setOnInsert: { schemaId, userId } },
      { upsert: true },
    );
  }
}
