import React, { useEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
// @ts-expect-error — zdog ships no types
import Zdog from "zdog";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Pseudo-3D match card driven by Zdog. Each goal becomes a small 3D
// scene: a tilted ring + a fan of straight rays radiating from a focal
// point in 3D space, all rendered as flat SVG shapes via Zdog.

const COLS = 30;
const ROWS_PER_SIDE = 30;
const TOTAL_ROWS = ROWS_PER_SIDE * 2;
const CANVAS_W = 1080;
const CANVAS_H = 2340;

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalCol: number;
  focalRow: number;
  primary: string;
};

export const GridMatchCardZdog: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;
  const svgRef = useRef<SVGSVGElement | null>(null);

  const cellW = PANEL_BOUNDS.width / COLS;
  const cellH = PANEL_BOUNDS.height / TOTAL_ROWS;
  const cellSize = Math.min(cellW, cellH);
  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;

  const resolved: ResolvedGoal[] = goals.map((g) => {
    const triggerFrame = minuteToFrame(g.minute);
    const halfCol = g.cell % 5;
    const halfRow = Math.floor(g.cell / 5);
    const focalCol = halfCol * (COLS / 5) + COLS / 10;
    const focalRowInHalf = halfRow * (ROWS_PER_SIDE / 4) + ROWS_PER_SIDE / 8;
    const focalRow =
      g.team === "home" ? focalRowInHalf : focalRowInHalf + ROWS_PER_SIDE;
    return {
      goal: g,
      triggerFrame,
      focalCol,
      focalRow,
      primary: g.team === "home" ? home.flagPrimary : away.flagPrimary,
    };
  });

  const BASE_RADIUS = 22;
  const ENTER_DUR = 36;
  const reveals = resolved.map((rg) => {
    const local = frame - rg.triggerFrame;
    if (local < 0) return 0;
    const t = Math.min(1, local / ENTER_DUR);
    const eased = 1 - Math.pow(1 - t, 3);
    return eased * BASE_RADIUS;
  });

  // Build the Zdog scene each frame. Using useEffect (not useLayoutEffect)
  // so it survives Remotion's render passes; clears children before each
  // re-render so the SVG never accumulates stale shapes.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Zdog auto-centers within the SVG viewport. We disable that so we
    // can address coordinates in the same canvas-space (0..CANVAS_W, 0..CANVAS_H)
    // that BaseLayout / score numerals already use — focal cells then
    // line up exactly with the rest of the card.
    const illo = new Zdog.Illustration({
      element: svg,
      centered: false,
      rotate: {
        x: -0.15 + Math.sin(frame * 0.012) * 0.05,
        y: Math.sin(frame * 0.008) * 0.18,
        z: 0,
      },
    });

    resolved.forEach((rg, i) => {
      const r = reveals[i];
      if (r <= 0.001) return;
      const fxPanel = PANEL_BOUNDS.left + rg.focalCol * cellW + cellW / 2;
      const fyPanel = PANEL_BOUNDS.top + rg.focalRow * cellH + cellH / 2;
      const localX = fxPanel;
      const localY = fyPanel;
      const rPx = r * cellSize;

      const goalGroup = new Zdog.Anchor({
        addTo: illo,
        translate: { x: localX, y: localY, z: 0 },
        rotate: { z: frame * 0.01 + i * 0.6 },
      });

      // Outer tilted ring.
      new Zdog.Ellipse({
        addTo: goalGroup,
        diameter: rPx * 1.7,
        stroke: 14,
        color: rg.primary,
        rotate: { x: -0.55, y: 0.2 },
      });

      // Inner ring, counter-tilted.
      new Zdog.Ellipse({
        addTo: goalGroup,
        diameter: rPx * 1.05,
        stroke: 9,
        color: rg.primary,
        rotate: { x: 0.4, y: -0.25 },
      });

      // Fan of rays radiating in 3D from the focal centre.
      const RAYS = 14;
      for (let k = 0; k < RAYS; k++) {
        const a = (k / RAYS) * Math.PI * 2;
        const reach = rPx * (0.9 + (k % 3) * 0.18);
        const cx = Math.cos(a) * reach;
        const cy = Math.sin(a) * reach;
        const cz = Math.sin(k * 1.7 + frame * 0.04) * rPx * 0.4;
        new Zdog.Shape({
          addTo: goalGroup,
          path: [
            { x: 0, y: 0, z: 0 },
            { x: cx, y: cy, z: cz },
          ],
          stroke: 6,
          color: rg.primary,
        });
      }

      // Centre dot — the goal anchor.
      new Zdog.Shape({
        addTo: goalGroup,
        translate: { x: 0, y: 0, z: rPx * 0.1 },
        stroke: 22,
        color: rg.primary,
      });
    });

    illo.updateRenderGraph();
  }, [frame, resolved.map((r) => `${r.triggerFrame}-${r.primary}`).join("|"), reveals.join("|"), cellSize]);

  const homeFiredFrames = resolved
    .filter((rg) => rg.goal.team === "home" && frame >= rg.triggerFrame)
    .map((rg) => rg.triggerFrame);
  const awayFiredFrames = resolved
    .filter((rg) => rg.goal.team === "away" && frame >= rg.triggerFrame)
    .map((rg) => rg.triggerFrame);
  const homeScoreNow = homeFiredFrames.length;
  const awayScoreNow = awayFiredFrames.length;
  const lastHomeBump =
    homeFiredFrames.length > 0
      ? homeFiredFrames[homeFiredFrames.length - 1]
      : -1;
  const lastAwayBump =
    awayFiredFrames.length > 0
      ? awayFiredFrames[awayFiredFrames.length - 1]
      : -1;
  const cx = (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2;

  return (
    <AbsoluteFill>
      <BaseLayout
        home={home}
        away={away}
        competition={competition}
        venue={venue}
        date={date}
      />
      <svg
        ref={svgRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
        width={CANVAS_W}
        height={CANVAS_H}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      />
      <ScoreNumeral
        value={homeScoreNow}
        color={home.flagPrimary}
        cx={cx}
        cy={(PANEL_BOUNDS.top + midY) / 2}
        bumpFrame={lastHomeBump}
        sweepFrames={8}
        sweepDirection="horizontal"
        outlineColor="#FFFFFF"
        outlineWidth={10}
      />
      <ScoreNumeral
        value={awayScoreNow}
        color={away.flagPrimary}
        cx={cx}
        cy={(midY + PANEL_BOUNDS.bottom) / 2}
        bumpFrame={lastAwayBump}
        sweepFrames={8}
        sweepDirection="horizontal"
        outlineColor="#FFFFFF"
        outlineWidth={10}
      />
    </AbsoluteFill>
  );
};

export { matchCardSchema };
