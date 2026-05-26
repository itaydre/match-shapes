import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Blank canvas — minimal chrome (team labels, score, panel), nothing
// drawn inside the pitch. Use this as a sandbox: drop in whatever
// animation experiment you're trying out by editing the `// ← INSERT
// EXPERIMENT HERE` block below. Everything else (score numerals,
// scorer name flash, dual flag stripes, midline) is provided so you
// can focus on the goal art.

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalX: number;
  focalY: number;
  primary: string;
};

export const GridMatchCardBlank: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;
  const cx = (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2;

  // Map goals into pixel-space focal points so experiments can read
  // them off `resolved` and use them however they like.
  const resolved: ResolvedGoal[] = goals.map((g) => {
    const triggerFrame = minuteToFrame(g.minute);
    const halfCol = g.cell % 5;
    const halfRow = Math.floor(g.cell / 5);
    const focalX =
      PANEL_BOUNDS.left + (halfCol / 5 + 1 / 10) * PANEL_BOUNDS.width;
    const focalRowFraction = halfRow / 4 + 1 / 8;
    const focalY =
      g.team === "home"
        ? PANEL_BOUNDS.top + focalRowFraction * (PANEL_BOUNDS.height / 2)
        : midY + focalRowFraction * (PANEL_BOUNDS.height / 2);
    return {
      goal: g,
      triggerFrame,
      focalX,
      focalY,
      primary: g.team === "home" ? home.flagPrimary : away.flagPrimary,
    };
  });

  // Per-goal reveal progress 0..1 — drive your experiment's entrance
  // off this.
  const reveals = resolved.map((rg) => {
    const local = frame - rg.triggerFrame;
    if (local < 0) return 0;
    const t = Math.min(1, local / 36);
    return 1 - Math.pow(1 - t, 3);
  });

  // Score state.
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
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
        width={1080}
        height={2340}
        viewBox="0 0 1080 2340"
      >
        <defs>
          <clipPath id="panel-clip-blank">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
          {/* Brazil-half mask — covers the BOTTOM half of the pitch
              with a jagged, organic top edge so the goal pattern
              doesn't end on a hard horizontal line. The edge is built
              from many short polyline segments with varied y heights,
              mirror-symmetric across the vertical centre. */}
          <clipPath id="brazil-half-jagged">
            {(() => {
              const midY =
                (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;
              const SEGMENTS = 24;
              const cxPanel =
                PANEL_BOUNDS.left + PANEL_BOUNDS.width / 2;
              const pts: string[] = [];
              // Build only the LEFT half's edge, then mirror.
              const leftEdge: Array<{ x: number; y: number }> = [];
              for (let i = 0; i <= SEGMENTS / 2; i++) {
                const u = i / (SEGMENTS / 2);
                const x =
                  PANEL_BOUNDS.left + u * (PANEL_BOUNDS.width / 2);
                // Compose a few sine waves + a deterministic hash so the
                // edge has both broad bumps and sharp jags.
                const wave1 =
                  Math.sin(u * 6 + frame * 0.02) * 36;
                const wave2 =
                  Math.sin(u * 13 + frame * 0.05) * 18;
                const hash = (Math.sin(i * 41.2 + frame * 0.01) + 1) * 16;
                const y = midY - 30 + wave1 + wave2 + hash;
                leftEdge.push({ x, y });
              }
              // Right half is left half mirrored across cxPanel.
              const rightEdge = leftEdge
                .slice(0, -1) // skip the centre point (it's at cxPanel)
                .reverse()
                .map((p) => ({
                  x: 2 * cxPanel - p.x,
                  y: p.y,
                }));
              const topEdge = [...leftEdge, ...rightEdge];
              // Build polygon: jagged top edge → right side down →
              // panel bottom → left side up → close.
              pts.push(
                ...topEdge.map(
                  (p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`,
                ),
              );
              pts.push(`${PANEL_BOUNDS.right},${PANEL_BOUNDS.bottom}`);
              pts.push(`${PANEL_BOUNDS.left},${PANEL_BOUNDS.bottom}`);
              return <polygon points={pts.join(" ")} />;
            })()}
          </clipPath>
        </defs>
        <g clipPath="url(#panel-clip-blank)">
          {/* White ground — anywhere a pixel is "discarded", this shows
              through. */}
          <rect
            x={PANEL_BOUNDS.left}
            y={PANEL_BOUNDS.top}
            width={PANEL_BOUNDS.width}
            height={PANEL_BOUNDS.height}
            fill="#FFFFFF"
          />
          {/* Pixel-art pattern on white, CLIPPED to the bottom (Brazil)
              half with a jagged top edge so the goal eruption doesn't
              end on a hard horizontal line. ~22% of cells are randomly
              discarded too — chipped pixels within the jagged half. */}
          <g clipPath="url(#brazil-half-jagged)">
          {(() => {
            const COLS = 60;
            const ROWS = 30;
            const cw = PANEL_BOUNDS.width / COLS;
            const ch = PANEL_BOUNDS.height / ROWS;
            const centerCol = (COLS - 1) / 2;
            const centerRow = (ROWS - 1) / 2;
            // Pure Brazil palette — green / yellow / blue. Home colours
            // are intentionally unused so the pattern reads as a single
            // national identity.
            const PALETTE = [
              away.flagPrimary,    // green
              away.flagSecondary,  // yellow
              away.flagAccent,     // blue
            ];
            // Deterministic per-cell hash → stable random discard pattern.
            const hash = (a: number, b: number): number => {
              let h = a * 374761393 + b * 668265263;
              h = (h ^ (h >>> 13)) * 1274126177;
              return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
            };
            // Mirror the discard so left and right halves stay symmetric.
            const out: React.ReactNode[] = [];
            for (let row = 0; row < ROWS; row++) {
              for (let col = 0; col < COLS; col++) {
                const mCol = Math.abs(col - centerCol);
                const dy = row - centerRow;
                const adY = Math.abs(dy);

                // Random discard ~22% — uses mirrored col so the
                // discard pattern is symmetric.
                const discardSeed = hash(
                  Math.floor(mCol + Math.sin(frame * 0.02) * 0.5),
                  row,
                );
                if (discardSeed < 0.22) continue;

                // Pattern wave — same V-shape logic but only picks
                // among the three team-colour slots (no "background"
                // index, that's now white).
                const wave =
                  mCol * 0.6 - adY * 0.85 + Math.sin(frame * 0.04) * 3;
                const noise =
                  Math.sin(mCol * 1.7 + row * 0.9 + frame * 0.06) * 0.7;
                const band = wave + noise;
                const insideCentre =
                  mCol < 8 && adY < 6 && mCol + adY * 1.4 < 12;
                let palIndex: number;
                if (insideCentre) {
                  palIndex = 2; // away.flagSecondary (centre plate)
                } else {
                  const q = ((band % 4) + 4) % 4;
                  if (q < 2) palIndex = 0; // home primary (dominant)
                  else if (q < 3) palIndex = 1; // away primary (accents)
                  else palIndex = 2; // away secondary (sparkle)
                }
                out.push(
                  <rect
                    key={`${col}-${row}`}
                    x={PANEL_BOUNDS.left + col * cw}
                    y={PANEL_BOUNDS.top + row * ch}
                    width={cw + 0.5}
                    height={ch + 0.5}
                    fill={PALETTE[palIndex]}
                  />,
                );
              }
            }
            return out;
          })()}
          </g>
        </g>
      </svg>
      <ScoreNumeral
        value={homeScoreNow}
        color={home.flagPrimary}
        cx={cx}
        cy={(PANEL_BOUNDS.top + midY) / 2}
        bumpFrame={lastHomeBump}
        sweepFrames={8}
        sweepDirection="horizontal"
      />
      <ScoreNumeral
        value={awayScoreNow}
        color={away.flagPrimary}
        cx={cx}
        cy={(midY + PANEL_BOUNDS.bottom) / 2}
        bumpFrame={lastAwayBump}
        sweepFrames={8}
        sweepDirection="horizontal"
      />
    </AbsoluteFill>
  );
};

export { matchCardSchema };
