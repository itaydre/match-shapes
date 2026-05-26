import React from "react";
import type { Controls, ControlValues } from "./sketches";
import { buildSandboxDoc } from "./sandboxRuntime";

// Mounts an AI-generated sketch inside a sandboxed iframe. The iframe
// runs with sandbox="allow-scripts" (no allow-same-origin), which
// isolates the AI code from the parent: it can't read parent
// localStorage, cookies, DOM, or use parent's credentials for fetch.
// Communication is one-way (parent → iframe) via postMessage:
//   { kind: "init", factoryCode, values } once on mount
//   { kind: "values", values } whenever slider values change

export const SandboxedSketchHost: React.FC<{
  factoryCode: string;
  controls: Controls;
  preview: boolean;
}> = ({ factoryCode, controls, preview }) => {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Stable srcdoc — only set once per mount so we don't re-create the
  // iframe on every control change.
  const srcdoc = React.useMemo(() => buildSandboxDoc(), []);

  // Initial values when the iframe boots.
  const valuesFromControls = (cs: Controls): ControlValues => {
    const out: ControlValues = {};
    for (const k of Object.keys(cs)) out[k] = cs[k]!.value;
    return out;
  };

  React.useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const msg = e.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.kind === "mounted") {
        setError(null);
        iframeRef.current?.contentWindow?.postMessage(
          {
            kind: "init",
            factoryCode,
            values: valuesFromControls(controls),
          },
          "*",
        );
      } else if (msg.kind === "error") {
        setError(typeof msg.message === "string" ? msg.message : "Unknown error");
      } else if (msg.kind === "ready") {
        setError(null);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // factoryCode change re-init is handled by remount via key prop in App.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factoryCode]);

  // Forward control value updates to the iframe live.
  React.useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { kind: "values", values: valuesFromControls(controls) },
      "*",
    );
  }, [controls]);

  return (
    <div style={preview ? wrapPreview : wrapStandalone}>
      <iframe
        ref={iframeRef}
        srcDoc={srcdoc}
        sandbox="allow-scripts"
        title="AI sketch sandbox"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          background: "transparent",
        }}
      />
      {error && (
        <div style={errorOverlay}>
          <strong>Sandbox error</strong>
          <div style={{ marginTop: 6, fontSize: 11 }}>{error}</div>
        </div>
      )}
    </div>
  );
};

const wrapPreview: React.CSSProperties = {
  width: "100%",
  height: "100%",
  position: "relative",
  overflow: "hidden",
};

const wrapStandalone: React.CSSProperties = {
  aspectRatio: "1 / 1",
  height: "min(100%, calc(100vh - 200px))",
  background: "#0d0d0e",
  boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px #2a2a2e",
  borderRadius: 6,
  overflow: "hidden",
  position: "relative",
};

const errorOverlay: React.CSSProperties = {
  position: "absolute",
  left: 8,
  right: 8,
  bottom: 8,
  padding: "10px 12px",
  background: "rgba(176,0,32,0.92)",
  color: "#fff",
  fontFamily: "monospace",
  fontSize: 12,
  borderRadius: 4,
  zIndex: 10,
};
