import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal, Team } from "./schema";
import { minuteToFrame } from "./lib/timing";

// One animation built in three steps. Three op-art panels live at fixed
// positions in the pitch and overlap as a collage. Every shape paints
// from the team palette (home + away flag colours). Later layers use
// mix-blend-mode: difference so overlap zones invert into new colours.
//
// Reveal language: each shape inside a tile is DRAWN — its outline
// traces along the path via strokeDashoffset, then the fill arrives
// once the outline is complete. Shapes within a tile are staggered so
// you see the panel sketch itself in one continuous motion.

const CANVAS_W = 1080;
const CANVAS_H = 2340;
// Per-shape draw schedule.
const STAGGER = 1; // frames between consecutive shapes starting
const STROKE_DUR = 12; // frames for the outline to trace
const FILL_DUR = 6; // frames for the fill to arrive after the trace

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

type Tile = { id: string; x: number; y: number; w: number; h: number };

const TILES: Tile[] = [
  { id: "stripes", x: 540, y: 220, w: 480, h: 640 },
  { id: "parallelograms", x: 360, y: 760, w: 620, h: 460 },
  { id: "barrel", x: 80, y: 420, w: 480, h: 720 },
];

// Single-colour palette: England red on the pitch's white background.
// Every shape across all three tiles paints in `primary` — no tile
// backdrops, no away-team mix-ins.
type Palette = { primary: string };
const buildTeamPalette = (home: Team, _away: Team): Palette => ({
  primary: home.flagPrimary,
});

// ── DrawnShape — handles the trace-then-fill animation per shape ────────

const DrawnShape: React.FC<{
  d: string;
  color: string;
  strokeColor?: string;
  index: number;
  local: number;
  strokeWidth?: number;
}> = ({ d, color, strokeColor, index, local, strokeWidth = 3 }) => {
  const shapeStart = index * STAGGER;
  const strokeT = clamp((local - shapeStart) / STROKE_DUR);
  const fillT = clamp((local - shapeStart - STROKE_DUR) / FILL_DUR);
  if (strokeT <= 0 && fillT <= 0) return null;
  const strokeEased = easeOutCubic(strokeT);
  return (
    <>
      {/* Outline trace */}
      <path
        d={d}
        fill="none"
        stroke={strokeColor ?? color}
        strokeWidth={strokeWidth}
        pathLength={100}
        strokeDasharray={100}
        strokeDashoffset={100 - strokeEased * 100}
        strokeLinejoin="miter"
        opacity={fillT >= 1 ? 0 : 1}
      />
      {/* Filled body — fades in after the outline finishes */}
      <path d={d} fill={color} opacity={fillT} />
    </>
  );
};

// ── Path builders (return d-strings + counts) ───────────────────────────

const buildDiagonalStripes = (r: Tile): { paths: string[] } => {
  const angle = -68 * (Math.PI / 180);
  const step = 90;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const diag = Math.hypot(r.w, r.h);
  const count = Math.ceil(diag / step) + 4;
  const paths: string[] = [];
  // Pre-compute rotation so each stripe is a regular polygon path.
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rot = (px: number, py: number): [number, number] => {
    const dx = px - cx;
    const dy = py - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  };
  for (let i = -count; i < count; i++) {
    if (((i % 2) + 2) % 2 !== 0) continue; // only one tone — the other is the bg
    const x0 = cx + i * step - step / 2;
    const x1 = x0 + step / 2;
    const y0 = cy - diag;
    const y1 = cy + diag;
    const [a, b] = rot(x0, y0);
    const [c, d] = rot(x1, y0);
    const [e, f] = rot(x1, y1);
    const [g, h] = rot(x0, y1);
    paths.push(
      `M ${a.toFixed(1)} ${b.toFixed(1)} L ${c.toFixed(1)} ${d.toFixed(1)} L ${e.toFixed(1)} ${f.toFixed(1)} L ${g.toFixed(1)} ${h.toFixed(1)} Z`,
    );
  }
  return { paths };
};

const buildParallelograms = (r: Tile): { paths: string[] } => {
  const skew = r.h * 0.55;
  const cols = 3;
  const gap = r.w / (cols * 3.4);
  const colW = (r.w + skew - gap * (cols - 1)) / cols;
  const paths: string[] = [];
  for (let c = 0; c < cols; c++) {
    const xTopL = r.x + c * (colW + gap);
    const xTopR = xTopL + colW;
    const xBotL = xTopL - skew;
    const xBotR = xTopR - skew;
    paths.push(
      `M ${xTopL.toFixed(1)} ${r.y} L ${xTopR.toFixed(1)} ${r.y} L ${xBotR.toFixed(1)} ${(r.y + r.h).toFixed(1)} L ${xBotL.toFixed(1)} ${(r.y + r.h).toFixed(1)} Z`,
    );
  }
  return { paths };
};

const buildBarrelStripes = (r: Tile): { paths: string[] } => {
  const stripeCount = 18;
  const stripeW = r.w / stripeCount;
  const samples = 24;
  const half = stripeW / 2;
  const bulge = stripeW * 0.55;
  const paths: string[] = [];
  for (let i = 0; i < stripeCount; i++) {
    if (i % 2 === 1) continue;
    const centerX = r.x + (i + 0.5) * stripeW;
    let d = "";
    for (let s = 0; s <= samples; s++) {
      const u = s / samples;
      const y = r.y + u * r.h;
      const bulgeAmt = Math.sin(u * Math.PI) * bulge;
      const x = centerX - half - bulgeAmt;
      d += `${s === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    for (let s = samples; s >= 0; s--) {
      const u = s / samples;
      const y = r.y + u * r.h;
      const bulgeAmt = Math.sin(u * Math.PI) * bulge;
      const x = centerX + half + bulgeAmt;
      d += `L ${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    d += "Z";
    paths.push(d);
  }
  return { paths };
};

// ── Tile renderers — background + ordered drawn shapes ─────────────────

// Tile renderers — inner shapes only, all in England red. No backdrops,
// no tile-rect fills; the white pitch shows through the gaps.
const Tile1: React.FC<{ tile: Tile; local: number; palette: Palette }> = ({ tile, local, palette }) => {
  const { paths } = React.useMemo(() => buildDiagonalStripes(tile), [tile]);
  return (
    <g>
      {paths.map((d, i) => (
        <DrawnShape key={i} d={d} color={palette.primary} index={i} local={local} />
      ))}
    </g>
  );
};

const Tile2: React.FC<{ tile: Tile; local: number; palette: Palette }> = ({ tile, local, palette }) => {
  const { paths } = React.useMemo(() => buildParallelograms(tile), [tile]);
  return (
    <g>
      {paths.map((d, i) => (
        <DrawnShape key={i} d={d} color={palette.primary} index={i} local={local} strokeWidth={5} />
      ))}
    </g>
  );
};

const Tile3: React.FC<{ tile: Tile; local: number; palette: Palette }> = ({ tile, local, palette }) => {
  const { paths } = React.useMemo(() => buildBarrelStripes(tile), [tile]);
  return (
    <g>
      {paths.map((d, i) => (
        <DrawnShape key={i} d={d} color={palette.primary} index={i} local={local} />
      ))}
    </g>
  );
};

const TILE_COMPONENTS = [Tile1, Tile2, Tile3];

// ── Composition ────────────────────────────────────────────────────────

export const GridMatchCardOpArtTiles: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const palette = buildTeamPalette(home, away);

  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;
  const cx = (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2;

  const triggers: number[] = goals.map((g: Goal) => minuteToFrame(g.minute));

  const homeFired = goals.filter(
    (g, i) => g.team === "home" && frame >= triggers[i]!,
  ).length;
  const awayFired = goals.filter(
    (g, i) => g.team === "away" && frame >= triggers[i]!,
  ).length;
  const lastHomeBump = goals
    .map((g, i) => ({ g, t: triggers[i]! }))
    .filter(({ g, t }) => g.team === "home" && frame >= t)
    .map(({ t }) => t)
    .pop();
  const lastAwayBump = goals
    .map((g, i) => ({ g, t: triggers[i]! }))
    .filter(({ g, t }) => g.team === "away" && frame >= t)
    .map(({ t }) => t)
    .pop();

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
        width={CANVAS_W}
        height={CANVAS_H}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      >
        <defs>
          <clipPath id="opart-panel-clip">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
          {TILES.map((t) => (
            <clipPath key={`rect-${t.id}`} id={`opart-rect-${t.id}`}>
              <rect x={t.x} y={t.y} width={t.w} height={t.h} />
            </clipPath>
          ))}
        </defs>

        <g clipPath="url(#opart-panel-clip)">
          {TILES.map((t, i) => {
            const trigger = triggers[i];
            if (trigger === undefined || frame < trigger) return null;
            const local = frame - trigger;
            const Comp = TILE_COMPONENTS[i]!;
            return (
              <g
                key={t.id}
                clipPath={`url(#opart-rect-${t.id})`}
              >
                <Comp tile={t} local={local} palette={palette} />
              </g>
            );
          })}
        </g>
      </svg>

      <ScoreNumeral
        value={homeFired}
        color={home.flagPrimary}
        cx={cx}
        cy={(PANEL_BOUNDS.top + midY) / 2}
        bumpFrame={lastHomeBump ?? -1}
        sweepFrames={8}
        sweepDirection="horizontal"
        outlineColor="#FFFFFF"
        outlineWidth={14}
      />
      <ScoreNumeral
        value={awayFired}
        color={away.flagPrimary}
        cx={cx}
        cy={(midY + PANEL_BOUNDS.bottom) / 2}
        bumpFrame={lastAwayBump ?? -1}
        sweepFrames={8}
        sweepDirection="horizontal"
        outlineColor="#FFFFFF"
        outlineWidth={14}
      />
    </AbsoluteFill>
  );
};

export { matchCardSchema };
