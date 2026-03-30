import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { sendMappedError } from "./mapError.js";

describe("sendMappedError", () => {
  it("maps payload too large", async () => {
    const app = Fastify();
    app.get("/t", async (_req, reply) => {
      const err = new Error("big");
      (err as Error & { code?: string }).code = "PAYLOAD_TOO_LARGE";
      return sendMappedError(reply, err);
    });
    const res = await app.inject({ method: "GET", url: "/t" });
    expect(res.statusCode).toBe(413);
  });

  it("maps upstream inference failures to 502", async () => {
    const app = Fastify();
    app.get("/t", async (_req, reply) => {
      return sendMappedError(reply, new Error("Chat completion failed"));
    });
    const res = await app.inject({ method: "GET", url: "/t" });
    expect(res.statusCode).toBe(502);
  });
});
