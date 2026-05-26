import React from "react";
import { createRoot } from "react-dom/client";
import { MatchShowcase } from "../playground/MatchShowcase";

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
            background: "#220000",
            color: "#FF8888",
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
            whiteSpace: "pre-wrap",
            minHeight: "100vh",
            margin: 0,
          }}
        >
          {`Match Showcase error:\n\n${this.state.error.message}\n\n${this.state.error.stack ?? ""}`}
        </pre>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <ErrorBoundary>
    <MatchShowcase />
  </ErrorBoundary>,
);
