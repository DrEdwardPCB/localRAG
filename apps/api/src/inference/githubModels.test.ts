import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigCache } from "../config.js";

const post = vi.fn();

vi.mock("@azure-rest/ai-inference", () => ({
  default: vi.fn(() => ({ path: () => ({ post }) })),
  isUnexpected: (r: unknown) => {
    const x = r as { status?: string };
    return x.status === "unexpected";
  },
}));

vi.mock("@azure/core-auth", () => ({
  AzureKeyCredential: vi.fn(),
}));

describe("githubModels", () => {
  beforeEach(() => {
    vi.resetModules();
    resetConfigCache();
    post.mockReset();
    process.env.GITHUB_TOKEN = "test-token";
    process.env.INFERENCE_ENDPOINT = "https://models.github.ai/inference";
    process.env.CHAT_MODEL = "openai/test-chat";
    process.env.EMBEDDING_MODEL = "openai/test-embed";
    delete process.env.EMBEDDING_INPUT_BATCH_MAX;
  });

  afterEach(() => {
    resetConfigCache();
  });

  it("embedTexts returns vectors on success", async () => {
    post.mockResolvedValue({
      status: "200",
      body: {
        data: [
          { index: 0, embedding: [0.1, 0.2] },
          { index: 1, embedding: [0.3, 0.4] },
        ],
      },
    });
    const { embedTexts } = await import("./githubModels.js");
    const out = await embedTexts(["a", "b"]);
    expect(out).toHaveLength(2);
    expect(out[0]![0]).toBeCloseTo(0.1);
  });

  it("embedTexts returns empty array for empty input", async () => {
    const { embedTexts } = await import("./githubModels.js");
    await expect(embedTexts([])).resolves.toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });

  it("embedTexts splits into multiple API calls when batch max is small", async () => {
    process.env.EMBEDDING_INPUT_BATCH_MAX = "2";
    resetConfigCache();
    post.mockImplementation(async (req: { body: { input: string[] } }) => {
      const input = req.body.input;
      return {
        status: "200",
        body: {
          data: input.map((_, idx) => ({
            index: idx,
            embedding: [idx + input.length * 0.01],
          })),
        },
      };
    });
    const { embedTexts } = await import("./githubModels.js");
    const out = await embedTexts(["a", "b", "c", "d", "e"]);
    expect(post).toHaveBeenCalledTimes(3);
    expect(out).toHaveLength(5);
  });

  it("embedTexts throws on unexpected response", async () => {
    post.mockResolvedValue({ status: "unexpected", body: { error: { message: "nope" } } });
    const { embedTexts } = await import("./githubModels.js");
    await expect(embedTexts(["x"])).rejects.toThrow("nope");
  });

  it("chatComplete returns assistant text", async () => {
    post.mockResolvedValue({
      status: "200",
      body: { choices: [{ message: { content: "hi" } }] },
    });
    const { chatComplete } = await import("./githubModels.js");
    const text = await chatComplete([{ role: "user", content: "yo" }]);
    expect(text).toBe("hi");
  });
});
