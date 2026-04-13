"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const USER_ID_KEY = "localrag_user_id";

function apiBase(): string {
  const base =
    process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:3002";
  return base.replace(/\/$/, "");
}

function readOrCreateUserId(): string {
  let id = sessionStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

function readOrCreateSessionId(): string {
  const key = "localrag_session_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

type Source = { id: string; title?: string; createdAt: string; schemaId?: string };

export default function HomePage() {
  const [userId, setUserId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>(
    [],
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [htmlPaste, setHtmlPaste] = useState("");
  const [title, setTitle] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [ingestBusy, setIngestBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** When true: API runs embedding + $vectorSearch only; no LLM; Redis chat history is not read or written. */
  const [vectorSearchOnly, setVectorSearchOnly] = useState(false);

  useEffect(() => {
    setUserId(readOrCreateUserId());
    setSessionId(readOrCreateSessionId());
  }, []);

  const base = useMemo(() => apiBase(), []);

  const refreshSources = useCallback(async () => {
    if (!userId) return;
    setError(null);
    const res = await fetch(
      `${base}/knowledge/sources?user_id=${encodeURIComponent(userId)}`,
    );
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    const data = (await res.json()) as { sources: Source[] };
    setSources(data.sources);
  }, [base, userId]);

  useEffect(() => {
    if (userId) void refreshSources();
  }, [refreshSources, userId]);

  const sendChat = async () => {
    if (!input.trim() || !sessionId || !userId) return;
    setLoading(true);
    setError(null);
    const userText = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", text: userText }]);
    try {
      const res = await fetch(`${base}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_message: userText,
          session_id: sessionId,
          user_id: userId,
          vector_search_only: vectorSearchOnly,
        }),
      });
      const data = (await res.json()) as
        | { mode: "chat"; reply: string }
        | {
            mode: "vector_search_only";
            hits: { text: string; score: number; knowledgeSourceId: string }[];
            contextText: string;
            schemaText: string | null;
          }
        | { error?: string };
      if (!res.ok) {
        throw new Error(
          "error" in data && typeof data.error === "string"
            ? data.error
            : res.statusText,
        );
      }
      if ("mode" in data && data.mode === "vector_search_only") {
        const lines = [
          `[Vector search only — ${data.hits.length} hit(s). LLM skipped; Redis not updated.]`,
        ];
        if (data.hits.length === 0) {
          lines.push(
            "(No chunks returned — check vector index, MONGODB_DB, user_id on chunks vs chat, and embedding model.)",
          );
        } else {
          data.hits.forEach((h, i) => {
            const preview =
              h.text.length > 800 ? `${h.text.slice(0, 800)}…` : h.text;
            lines.push(
              `#${i + 1} score=${h.score.toFixed(4)} source=${h.knowledgeSourceId}\n${preview}`,
            );
          });
        }
        setMessages((m) => [...m, { role: "assistant", text: lines.join("\n\n") }]);
      } else if ("mode" in data && data.mode === "chat" && "reply" in data) {
        setMessages((m) => [...m, { role: "assistant", text: data.reply }]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", text: JSON.stringify(data, null, 2) },
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  };

  const ingest = async () => {
    if (!htmlPaste.trim() || !userId) return;
    setIngestBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}/knowledge/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: htmlPaste,
          user_id: userId,
          title: title || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? res.statusText);
      setHtmlPaste("");
      setTitle("");
      await refreshSources();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ingest failed");
    } finally {
      setIngestBusy(false);
    }
  };

  const removeSource = async (id: string) => {
    if (!userId) return;
    setError(null);
    const res = await fetch(
      `${base}/knowledge/sources/${id}?user_id=${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    await refreshSources();
  };

  const newSession = () => {
    sessionStorage.removeItem("localrag_session_id");
    setSessionId(readOrCreateSessionId());
    setMessages([]);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: 16 }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: "1.25rem" }}>Local RAG</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setPanelOpen((v) => !v)}>
              {panelOpen ? "Hide knowledge" : "Knowledge"}
            </button>
            <button type="button" onClick={newSession}>
              New chat session
            </button>
          </div>
        </header>
        <p style={{ opacity: 0.7, fontSize: 12 }}>
          User id: {userId} · Session: {sessionId || "…"}
        </p>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            marginBottom: 8,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={vectorSearchOnly}
            onChange={(e) => setVectorSearchOnly(e.target.checked)}
          />
          <span>
            Vector search only (debug) — no LLM, no Redis history read/write
          </span>
        </label>
        {error && (
          <div style={{ color: "#f28b82", marginBottom: 8 }} role="alert">
            {error}
          </div>
        )}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            border: "1px solid #30343c",
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
            background: "#16191f",
          }}
        >
          {messages.length === 0 && (
            <p style={{ opacity: 0.6 }}>Send a message to start. Ingest HTML from the side panel for grounded answers.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <strong>{m.role === "user" ? "You" : "Assistant"}</strong>
              <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #30343c", background: "#16191f", color: "#e8eaed" }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message…"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void sendChat()}
          />
          <button type="button" disabled={loading} onClick={() => void sendChat()}>
            {loading ? "…" : "Send"}
          </button>
        </div>
      </main>
      {panelOpen && (
        <aside
          style={{
            width: 360,
            borderLeft: "1px solid #30343c",
            padding: 16,
            background: "#12141a",
            overflowY: "auto",
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Knowledge</h2>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Title (optional)</label>
          <input
            style={{ width: "100%", marginBottom: 8, padding: 8, borderRadius: 6, border: "1px solid #30343c", background: "#16191f", color: "#e8eaed" }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Raw HTML</label>
          <textarea
            style={{
              width: "100%",
              minHeight: 160,
              padding: 8,
              borderRadius: 6,
              border: "1px solid #30343c",
              background: "#16191f",
              color: "#e8eaed",
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
            }}
            value={htmlPaste}
            onChange={(e) => setHtmlPaste(e.target.value)}
          />
          <button type="button" disabled={ingestBusy} onClick={() => void ingest()}>
            {ingestBusy ? "Uploading…" : "Upload"}
          </button>
          <h3 style={{ fontSize: "0.9rem", marginTop: 20 }}>Sources</h3>
          <ul style={{ paddingLeft: 16 }}>
            {sources.map((s) => (
              <li key={s.id} style={{ marginBottom: 8 }}>
                <div>{s.title || s.id}</div>
                <button type="button" onClick={() => void removeSource(s.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
