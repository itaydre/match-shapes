import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const showError = (msg: string) => {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:99999;padding:14px;background:#B00020;color:#fff;font:13px/1.4 monospace;white-space:pre-wrap;max-height:60vh;overflow:auto;";
  el.textContent = msg;
  document.body.appendChild(el);
};
window.addEventListener("error", (e) => {
  showError(`window.error: ${e.message}\n${e.error?.stack ?? ""}`);
});
window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason as Error | undefined;
  showError(`unhandledrejection: ${r?.message ?? String(e.reason)}\n${r?.stack ?? ""}`);
});

createRoot(document.getElementById("root")!).render(<App />);
