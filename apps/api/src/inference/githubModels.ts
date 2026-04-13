import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import { getConfig, requireGithubToken } from "../config.js";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function getClient() {
  const cfg = getConfig();
  const token = requireGithubToken();
  return ModelClient(cfg.INFERENCE_ENDPOINT, new AzureKeyCredential(token));
}

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  const cfg = getConfig();
  const client = getClient();
  const response = await client.path("/embeddings").post({
    body: {
      input: inputs,
      model: cfg.EMBEDDING_MODEL,
    },
  });

  if (isUnexpected(response)) {
    const err = (response.body as { error?: { message?: string } })?.error;
    throw new Error(err?.message ?? "Embeddings request failed");
  }

  const data = (response.body as { data?: { embedding: number[]; index: number }[] }).data;
  if (!data?.length) throw new Error("Embeddings response missing data");
  return data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function chatComplete(messages: ChatMessage[]): Promise<string> {
  const cfg = getConfig();
  const client = getClient();
  
  const payload ={
    body: {
      model: cfg.CHAT_MODEL,
      messages,
    },
  }
  console.log("chatComplete payload", payload);
  const response = await client.path("/chat/completions").post(payload);
  console.log("chatComplete response", response);
  if (isUnexpected(response)) {
    const err = (response.body as { error?: { message?: string } })?.error;
    throw new Error(err?.message ?? "Chat completion failed");
  }

  const body = response.body as {
    choices?: { message?: { content?: string | null } }[];
  };
  const text = body.choices?.[0]?.message?.content;
  if (text == null || text === "") {
    throw new Error("Chat completion returned empty content");
  }
  return text;
}
