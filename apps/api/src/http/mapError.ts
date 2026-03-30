import type { FastifyReply } from "fastify";

export function sendMappedError(reply: FastifyReply, err: unknown): FastifyReply {
  const code = (err as { code?: string })?.code;
  const message = err instanceof Error ? err.message : "Internal error";

  if (code === "PAYLOAD_TOO_LARGE") {
    return reply.status(413).send({ error: message });
  }
  if (code === "EMPTY_CONTENT") {
    return reply.status(400).send({ error: message });
  }

  if (message.includes("GITHUB_TOKEN")) {
    return reply.status(500).send({ error: "Server misconfiguration" });
  }

  if (
    message.includes("Embeddings") ||
    message.includes("Chat completion") ||
    message.includes("inference")
  ) {
    return reply.status(502).send({ error: message });
  }

  return reply.status(500).send({ error: message });
}
