import React from "react";
import { createRoot } from "react-dom/client";
import { gsap } from "gsap";
import { RenderMatch } from "../playground/RenderMatch";

// Deterministic GSAP: stop the auto rAF ticker so the shape-reveal
// tweens only advance when the headless renderer seeks the global
// timeline via window.__seekGsap(timeSeconds). This makes the
// otherwise wall-clock reveals frame-exact.
gsap.ticker.lagSmoothing(0);
gsap.ticker.remove(gsap.updateRoot);
(window as unknown as { __seekGsap: (t: number) => void }).__seekGsap = (
  t: number,
) => gsap.updateRoot(t);

const root = createRoot(document.getElementById("root")!);
root.render(<RenderMatch />);
