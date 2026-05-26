import React from "react";
import { createRoot } from "react-dom/client";
import { ShapeStudio } from "../playground/ShapeStudio";

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
            minHeight: "100vh",
            margin: 0,
          }}
        >
          {`Shape Studio error:\n\n${this.state.error.message}\n\n${this.state.error.stack ?? ""}`}
        </pre>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <ErrorBoundary>
    <ShapeStudio />
  </ErrorBoundary>,
);
