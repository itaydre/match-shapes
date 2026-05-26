import React from "react";
import type { Controls } from "./sketches";
import type { UserSketch } from "./userSketches";

// Chat panel for AI-driven sketch creation. Talks to the local Vite
// proxy at /api/generate, which forwards to Anthropic with the server's
// API key. The proxy never exposes the key to the browser.

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  // Sketch returned by the assistant turn, if any.
  sketch?: UserSketch;
  error?: string;
};

type SketchSpec = {
  id?: string;
  name?: string;
  description?: string;
  controls?: Controls;
  factoryCode?: string;
};

const newId = () => Math.random().toString(36).slice(2, 10);

const parseSketchJson = (
  text: string,
): { ok: true; spec: SketchSpec } | { ok: false; error: string } => {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as SketchSpec;
    if (!parsed.id || !parsed.name || !parsed.factoryCode || !parsed.controls) {
      return { ok: false, error: "AI response missing id/name/controls/factoryCode" };
    }
    return { ok: true, spec: parsed };
  } catch (err) {
    return { ok: false, error: `Not valid JSON: ${(err as Error).message}` };
  }
};

export const Chat: React.FC<{
  onNewSketch: (s: UserSketch) => void;
}> = ({ onNewSketch }) => {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: newId(),
      role: "system",
      content:
        "Describe an animation in plain English. Example: 'Pulsing concentric circles in England red and white that follow the mouse'. The result is sandboxed.",
    },
  ]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const logRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const userMsg: ChatMessage = { id: newId(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    // Only past user/assistant turns are sent — the proxy adds the
    // system prompt server-side.
    const history = [...messages, userMsg]
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const msg: ChatMessage = {
          id: newId(),
          role: "assistant",
          content: "",
          error: data.error ?? `HTTP ${res.status}`,
        };
        setMessages((prev) => [...prev, msg]);
        return;
      }
      const text: string = data?.content?.[0]?.text ?? "";
      const parsed = parseSketchJson(text);
      if (!parsed.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: text,
            error: parsed.error,
          },
        ]);
        return;
      }
      const sketch: UserSketch = {
        id: parsed.spec.id!,
        name: parsed.spec.name!,
        description: parsed.spec.description ?? "",
        controls: parsed.spec.controls!,
        factoryCode: parsed.spec.factoryCode!,
        createdAt: Date.now(),
      };
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: `Generated "${sketch.name}". Select it from the dropdown to try it.`,
          sketch,
        },
      ]);
      onNewSketch(sketch);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: "",
          error: `Network error: ${(err as Error).message}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={wrap}>
      <div ref={logRef} style={log}>
        {messages.map((m) => (
          <Message key={m.id} msg={m} />
        ))}
        {sending && (
          <div style={{ ...bubble, ...assistantBubble, opacity: 0.6 }}>
            <em>generating…</em>
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        style={composer}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Describe an animation…   (⌘/Ctrl + Enter to send)"
          rows={3}
          style={textarea}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="submit"
            disabled={sending || !input.trim()}
            style={{ ...btnPrimary, flex: 1, opacity: sending ? 0.6 : 1 }}
          >
            {sending ? "…" : "Generate"}
          </button>
        </div>
      </form>
    </div>
  );
};

const Message: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  if (msg.role === "system") {
    return (
      <div style={systemBubble}>
        <em>{msg.content}</em>
      </div>
    );
  }
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div style={{ ...bubble, ...(isUser ? userBubble : assistantBubble) }}>
        {msg.error ? (
          <>
            <div style={{ color: "#FF8A80", fontSize: 11, fontWeight: 600 }}>
              Error
            </div>
            <div style={{ fontSize: 12, marginTop: 4, whiteSpace: "pre-wrap" }}>
              {msg.error}
            </div>
            {msg.content && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ cursor: "pointer", fontSize: 11, opacity: 0.7 }}>
                  Raw response
                </summary>
                <pre style={preBlock}>{msg.content}</pre>
              </details>
            )}
          </>
        ) : (
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{msg.content}</div>
        )}
      </div>
    </div>
  );
};

const wrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  background: "#13131a",
};

const log: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: "12px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const bubble: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  maxWidth: "92%",
  lineHeight: 1.45,
};

const userBubble: React.CSSProperties = {
  background: "#22232a",
  color: "#e8e6e1",
  border: "1px solid #3a3a3f",
};

const assistantBubble: React.CSSProperties = {
  background: "#1a1c22",
  color: "#cdd0d4",
  border: "1px solid #2a2a2e",
};

const systemBubble: React.CSSProperties = {
  fontSize: 11.5,
  color: "#888",
  textAlign: "center",
  padding: "6px 10px",
  border: "1px dashed #2a2a2e",
  borderRadius: 6,
};

const composer: React.CSSProperties = {
  padding: 12,
  borderTop: "1px solid #2a2a2e",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  background: "#16161a",
};

const textarea: React.CSSProperties = {
  background: "#0d0d0e",
  color: "#e8e6e1",
  border: "1px solid #2a2a2e",
  padding: "8px 10px",
  borderRadius: 4,
  fontSize: 13,
  fontFamily: "inherit",
  resize: "vertical",
  outline: "none",
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 14px",
  fontSize: 12,
  border: "1px solid #e8e6e1",
  background: "#e8e6e1",
  color: "#16161a",
  cursor: "pointer",
  borderRadius: 3,
  fontWeight: 600,
};

const preBlock: React.CSSProperties = {
  marginTop: 6,
  padding: 8,
  background: "#0d0d0e",
  border: "1px solid #2a2a2e",
  borderRadius: 4,
  fontSize: 11,
  maxHeight: 200,
  overflow: "auto",
  whiteSpace: "pre-wrap",
};
