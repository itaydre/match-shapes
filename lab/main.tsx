import React from "react";
import { createRoot } from "react-dom/client";
import { BrazilSketchLab } from "../playground/BrazilSketchLab";

// Visible runtime-error overlay — any uncaught throw or rejected
// promise paints a red banner so a blank page is never silent.
const showError = (msg: string) => {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:99999;padding:16px;background:#B00020;color:#fff;font:13px/1.4 monospace;white-space:pre-wrap;max-height:60vh;overflow:auto;";
  el.textContent = msg;
  document.body.appendChild(el);
};
window.addEventListener("error", (e) => {
  showError(`window.error: ${e.message}\n${e.error?.stack ?? ""}`);
});
window.addEventListener("unhandledrejection", (e) => {
  showError(
    `unhandledrejection: ${(e.reason as Error)?.message ?? String(e.reason)}\n${
      (e.reason as Error)?.stack ?? ""
    }`,
  );
});

// React error boundary so any throw inside the lab paints a visible
// banner instead of unmounting silently.
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(err: Error) {
    return { error: err };
  }
  render() {
    if (this.state.error) {
      return (
        <pre
          style={{
            padding: 24,
            background: "#FFF1F0",
            color: "#B00020",
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
            whiteSpace: "pre-wrap",
            margin: 0,
            minHeight: "100vh",
          }}
        >
          {`Lab error:\n\n${this.state.error.message}\n\n${this.state.error.stack ?? ""}`}
        </pre>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

const root = createRoot(document.getElementById("root")!);
try {
  root.render(
    <ErrorBoundary>
      <BrazilSketchLab />
    </ErrorBoundary>,
  );
} catch (err) {
  showError(`render threw: ${(err as Error).message}\n${(err as Error).stack}`);
}
