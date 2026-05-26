import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Diagonal pixel-pattern variant. Same Brazil-only palette and white
// ground as `GridMatchCardBlank`, but the wave bands run on a diagonal
// axis and the cell grid is sparser (fewer, wider cells) for a less
// dense composition.

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalX: number;
  focalY: number;
  primary: string;
};

export const GridMatchCardBlankDiagonal: React.FC<MatchCardProps> = (
  props,
) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;
  const cx = (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2;

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
          <clipPath id="panel-clip-blankd">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
          <clipPath id="brazil-half-jagged-d">
            {(() => {
              const SEGMENTS = 24;
              const cxPanel =
                PANEL_BOUNDS.left + PANEL_BOUNDS.width / 2;
              const leftEdge: Array<{ x: number; y: number }> = [];
              for (let i = 0; i <= SEGMENTS / 2; i++) {
                const u = i / (SEGMENTS / 2);
                const x =
                  PANEL_BOUNDS.left + u * (PANEL_BOUNDS.width / 2);
                const wave1 = Math.sin(u * 6 + frame * 0.02) * 36;
                const wave2 = Math.sin(u * 13 + frame * 0.05) * 18;
                const hash =
                  (Math.sin(i * 41.2 + frame * 0.01) + 1) * 16;
                const y = midY - 30 + wave1 + wave2 + hash;
                leftEdge.push({ x, y });
              }
              const rightEdge = leftEdge
                .slice(0, -1)
                .reverse()
                .map((p) => ({ x: 2 * cxPanel - p.x, y: p.y }));
              const topEdge = [...leftEdge, ...rightEdge];
              const pts: string[] = [];
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
        <g clipPath="url(#panel-clip-blankd)">
          <rect
            x={PANEL_BOUNDS.left}
            y={PANEL_BOUNDS.top}
            width={PANEL_BOUNDS.width}
            height={PANEL_BOUNDS.height}
            fill="#FFFFFF"
          />
          <g clipPath="url(#brazil-half-jagged-d)">
            {(() => {
              // Isometric lattice — every cell is a diamond (rhombus
              // with vertical short axis), positioned on the classic
              // isometric axes:
              //   screenX = (col - row) * tileW/2
              //   screenY = (col + row) * tileH/2
              // The lattice has more cells than the visible viewport so
              // the diamond tiling fills the half cleanly.
              const COLS = 28;
              const ROWS = 18;
              const tileW = (PANEL_BOUNDS.width / COLS) * 1.6;
              const tileH = tileW * 0.5; // classic 2:1 iso tile aspect
              const originX =
                PANEL_BOUNDS.left + PANEL_BOUNDS.width / 2;
              const originY = midY;
              const centerCol = (COLS - 1) / 2;
              const centerRow = (ROWS - 1) / 2;
              const PALETTE = [
                away.flagPrimary,    // green
                away.flagSecondary,  // yellow
                away.flagAccent,     // blue
              ];
              const hash = (a: number, b: number): number => {
                let h = a * 374761393 + b * 668265263;
                h = (h ^ (h >>> 13)) * 1274126177;
                return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
              };
              const out: React.ReactNode[] = [];
              for (let row = 0; row < ROWS; row++) {
                for (let col = 0; col < COLS; col++) {
                  const dCol = col - centerCol;
                  const dRow = row - centerRow;
                  // Cell centre in iso projection.
                  const cx0 =
                    originX + (dCol - dRow) * (tileW / 2);
                  const cy0 =
                    originY + (dCol + dRow) * (tileH / 2);
                  // Cull cells that would land entirely outside the
                  // panel (after clipping they'd be wasted geometry).
                  if (
                    cx0 < PANEL_BOUNDS.left - tileW ||
                    cx0 > PANEL_BOUNDS.right + tileW ||
                    cy0 < midY - tileH ||
                    cy0 > PANEL_BOUNDS.bottom + tileH
                  ) {
                    continue;
                  }

                  // Mirror parity — left/right of vertical axis
                  // mirror, like the rectangular version.
                  const mCol = Math.abs(dCol);
                  const adY = Math.abs(dRow);
                  const discardSeed = hash(
                    Math.floor(mCol + Math.sin(frame * 0.02) * 0.5),
                    row,
                  );
                  if (discardSeed < 0.38) continue;
                  const wave =
                    (mCol + adY) * 0.7 +
                    Math.sin(frame * 0.04 + (mCol - adY) * 0.3) * 2.5;
                  const noise =
                    Math.sin(mCol * 1.7 + row * 0.9 + frame * 0.06) * 0.7;
                  const band = wave + noise;
                  const insideCentre =
                    mCol < 4 && adY < 3 && mCol + adY * 1.4 < 6;
                  let palIndex: number;
                  if (insideCentre) {
                    palIndex = 2;
                  } else {
                    const q = ((band % 4) + 4) % 4;
                    if (q < 2) palIndex = 0;
                    else if (q < 3) palIndex = 1;
                    else palIndex = 2;
                  }
                  // Diamond corners: top, right, bottom, left of the
                  // iso tile.
                  const halfW = tileW / 2;
                  const halfH = tileH / 2;
                  const pts =
                    `${cx0.toFixed(1)},${(cy0 - halfH).toFixed(1)} ` +
                    `${(cx0 + halfW).toFixed(1)},${cy0.toFixed(1)} ` +
                    `${cx0.toFixed(1)},${(cy0 + halfH).toFixed(1)} ` +
                    `${(cx0 - halfW).toFixed(1)},${cy0.toFixed(1)}`;
                  out.push(
                    <polygon
                      key={`${col}-${row}`}
                      points={pts}
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
