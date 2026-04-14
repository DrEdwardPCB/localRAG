import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_HTML_WITH_SCRIPT } from "../test/fixtures/htmlSamples.js";

const embedTexts = vi.fn();
vi.mock("../inference/githubModels.js", () => ({ embedTexts }));

describe("ingestHtml", () => {
  beforeEach(() => {
    embedTexts.mockReset();
    process.env.MAX_INGEST_BYTES = "100000";
    process.env.CHUNK_SIZE = "200";
    process.env.CHUNK_OVERLAP = "20";
    process.env.MONGODB_URI = "mongodb://localhost";
    process.env.MONGODB_DB = "t";
    process.env.REDIS_URL = "redis://localhost";
    process.env.GITHUB_TOKEN = "t";
  });

  it("rejects oversized html", async () => {
    const { ingestHtml } = await import("./ingestService.js");
    const repo = {
      insertSource: vi.fn(),
      insertChunks: vi.fn(),
    } as never;
    const big = "z".repeat(200_000);
    await expect(
      ingestHtml(repo, { html: big, userId: "u1" }),
    ).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
  });

  it("ingests sample html with mocked embeddings", async () => {
    embedTexts.mockImplementation(async (texts: string[]) =>
      texts.map(() => [0, 0, 0]),
    );
    const { ingestHtml } = await import("./ingestService.js");
    const oid = new ObjectId();
    const insertSource = vi.fn().mockResolvedValue(oid);
    const insertChunks = vi.fn().mockResolvedValue(undefined);
    const repo = { insertSource, insertChunks } as never;
    const res = await ingestHtml(repo, { html: SAMPLE_HTML_WITH_SCRIPT, userId: "u1" });
    expect(res.sourceId).toBe(oid.toHexString());
    expect(insertChunks).toHaveBeenCalled();
    const chunks = insertChunks.mock.calls[0]![0] as { embedding: number[] }[];
    expect(chunks[0]!.embedding).toEqual([0, 0, 0]);
  });

  it("deletes source when insertChunks fails", async () => {
    embedTexts.mockImplementation(async (texts: string[]) =>
      texts.map(() => [0, 0, 0]),
    );
    const { ingestHtml } = await import("./ingestService.js");
    const oid = new ObjectId();
    const insertSource = vi.fn().mockResolvedValue(oid);
    const insertChunks = vi.fn().mockRejectedValue(new Error("mongo write failed"));
    const deleteSource = vi.fn().mockResolvedValue(true);
    const repo = { insertSource, insertChunks, deleteSource } as never;
    await expect(
      ingestHtml(repo, { html: SAMPLE_HTML_WITH_SCRIPT, userId: "u1" }),
    ).rejects.toThrow("mongo write failed");
    expect(deleteSource).toHaveBeenCalledWith(oid.toHexString(), "u1");
  });
});
