import { describe, expect, it, vi } from "vitest";
import type { KnowledgeRepository } from "./mongo/knowledgeRepository.js";
import { createApp } from "./app.js";

describe("GET /knowledge/users", () => {
  it("returns distinct user_ids from the repository", async () => {
    const listDistinctUserIds = vi.fn().mockResolvedValue(["alice", "bob"]);
    const repo = { listDistinctUserIds } as unknown as KnowledgeRepository;
    const app = await createApp({
      mongo: {} as never,
      redis: {} as never,
      repo,
      history: {} as never,
    });

    const res = await app.inject({ method: "GET", url: "/knowledge/users" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ user_ids: ["alice", "bob"] });
    expect(listDistinctUserIds).toHaveBeenCalledOnce();
    await app.close();
  });
});
