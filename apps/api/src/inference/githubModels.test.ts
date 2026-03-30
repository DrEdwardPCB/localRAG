import { beforeEach, describe, expect, it, vi } from "vitest";

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
    post.mockReset();
    process.env.GITHUB_TOKEN = "test-token";
    process.env.INFERENCE_ENDPOINT = "https://models.github.ai/inference";
    process.env.CHAT_MODEL = "openai/test-chat";
    process.env.EMBEDDING_MODEL = "openai/test-embed";
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
