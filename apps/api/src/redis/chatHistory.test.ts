import { describe, expect, it, vi } from "vitest";
import { RedisChatHistoryStore } from "./chatHistory.js";

describe("RedisChatHistoryStore", () => {
  it("uses expected key pattern", () => {
    expect(RedisChatHistoryStore.keyForSession("abc")).toBe("chat:session:abc");
  });

  it("appends and caps messages with TTL", async () => {
    const store = new Map<string, string>();
    const redis = {
      get: vi.fn(async (k: string) => store.get(k) ?? null),
      set: vi.fn(async (k: string, v: string, _mode: string, ttl: number) => {
        store.set(k, v);
        expect(ttl).toBeGreaterThan(0);
      }),
    };
    const hist = new RedisChatHistoryStore(redis as never);
    await hist.append("s1", { role: "user", content: "a" }, 2);
    await hist.append("s1", { role: "assistant", content: "b" }, 2);
    await hist.append("s1", { role: "user", content: "c" }, 2);
    const loaded = await hist.load("s1", 2);
    expect(loaded).toHaveLength(2);
    expect(loaded[0]?.content).toBe("b");
    expect(loaded[1]?.content).toBe("c");
  });
});
