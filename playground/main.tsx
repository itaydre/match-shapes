import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

// Top-level global error trap — any uncaught throw or rejected promise
// will paint to a fixed overlay so a blank page is never silent.
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

const root = createRoot(document.getElementById("root")!);
try {
  root.render(<App />);
} catch (err) {
  showError(`render threw: ${(err as Error).message}\n${(err as Error).stack}`);
}
