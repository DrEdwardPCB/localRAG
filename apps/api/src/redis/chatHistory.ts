import { Redis } from "ioredis";
import { getConfig } from "../config.js";

export type StoredTurn = { role: "user" | "assistant"; content: string };

function sessionKey(sessionId: string): string {
  return `chat:session:${sessionId}`;
}

export class RedisChatHistoryStore {
  constructor(private readonly redis: Redis) {}

  private async readAll(sessionId: string): Promise<StoredTurn[]> {
    const raw = await this.redis.get(sessionKey(sessionId));
    if (!raw) return [];
    try {
      const turns = JSON.parse(raw) as StoredTurn[];
      return Array.isArray(turns) ? turns : [];
    } catch {
      return [];
    }
  }

  async load(sessionId: string, maxMessages: number): Promise<StoredTurn[]> {
    const turns = await this.readAll(sessionId);
    return turns.slice(-maxMessages);
  }

  async append(sessionId: string, turn: StoredTurn, maxMessages: number): Promise<void> {
    const cfg = getConfig();
    const key = sessionKey(sessionId);
    const prev = await this.readAll(sessionId);
    const next = [...prev, turn].slice(-maxMessages);
    await this.redis.set(key, JSON.stringify(next), "EX", cfg.CHAT_HISTORY_TTL_SECONDS);
  }

  /** Exposed for tests — key pattern used for sessions */
  static keyForSession(sessionId: string): string {
    return sessionKey(sessionId);
  }
}
