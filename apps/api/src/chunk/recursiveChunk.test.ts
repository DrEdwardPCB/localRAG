import { describe, expect, it } from "vitest";
import { chunkText } from "./recursiveChunk.js";

describe("chunkText", () => {
  it("splits long text with overlap", async () => {
    const text = "a".repeat(50);
    const chunks = await chunkText(text, 20, 5);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("").length).toBeGreaterThanOrEqual(50);
  });
});
