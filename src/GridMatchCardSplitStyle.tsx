import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Each half of the pitch carries a completely different visual language:
//   • HOME (top)    → pink/blue checkered sunburst with concentric
//                     phase-shifted ring-wedges (Riley moiré).
//   • AWAY (bottom) → multi-colour triangle shard fan opening downward.
// Each goal is rendered as the version belonging to its team's half.

const COLS = 30;
const ROWS_PER_SIDE = 30;
const TOTAL_ROWS = ROWS_PER_SIDE * 2;

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalCol: number;
  focalRow: number;
};

// ─── Home half: pink/blue checkered sunburst ───────────────────────────────
// Stacked dashed circles produce a 64-wedge alternating fan; phase-shifted
// inner rings break the fan into a checker. Opens 180° upward from the
// focal cell.
const SunburstHome: React.FC<{
  fx: number;
  fy: number;
  rPx: number;
  primary: string;
  accent: string;
}> = ({ fx, fy, rPx, primary, accent }) => {
  // Outer dashed ring → 64 wedges of `accent` over a `primary` disc. We
  // clip the resulting half-disk so the burst opens upward.
  const clipId = `sb-clip-${fx.toFixed(0)}-${fy.toFixed(0)}-${rPx.toFixed(0)}`;
  const ringCircum = 2 * Math.PI * (rPx * 0.5);
  const dash = ringCircum / 64;
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={fx - rPx} y={fy - rPx} width={rPx * 2} height={rPx} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`} opacity={0.92}>
        {/* solid primary disc — soft-edged via a radial gradient mask
            so the bloom melts into the cream pitch instead of meeting
            it on a hard rim. */}
        <defs>
          <radialGradient id={`feather-${clipId}`} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.78" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id={`feather-mask-${clipId}`}>
            <rect
              x={fx - rPx}
              y={fy - rPx}
              width={rPx * 2}
              height={rPx * 2}
              fill={`url(#feather-${clipId})`}
            />
          </mask>
        </defs>
        <g mask={`url(#feather-mask-${clipId})`}>
          <circle cx={fx} cy={fy} r={rPx} fill={primary} />
          {/* 64 alternating accent wedges via stroked dashed circle */}
          <circle
            cx={fx}
            cy={fy}
            r={rPx * 0.5}
            fill="none"
            stroke={accent}
            strokeWidth={rPx}
            strokeDasharray={`${dash} ${dash}`}
          />
          {/* concentric phase-shifted band → checker break at the rim */}
          <circle
            cx={fx}
            cy={fy}
            r={rPx * 0.78}
            fill="none"
            stroke={primary}
            strokeWidth={rPx * 0.18}
            strokeDasharray={`${dash * 0.62} ${dash * 0.62}`}
            strokeDashoffset={dash * 0.31}
          />
          <circle
            cx={fx}
            cy={fy}
            r={rPx * 0.55}
            fill="none"
            stroke={accent}
            strokeWidth={rPx * 0.16}
            strokeDasharray={`${dash * 0.5} ${dash * 0.5}`}
          />
          {/* centre disc */}
          <circle cx={fx} cy={fy} r={rPx * 0.08} fill={primary} />
        </g>
      </g>
    </g>
  );
};

// ─── Away half: multi-colour triangle shard fan ───────────────────────────
// Many narrow wedges fanning downward from a focal point on the midline,
// cycling through the AWAY TEAM's real flag colours (primary / secondary /
// accent) so the burst belongs to the team rather than a generic palette.
const ShardFanAway: React.FC<{
  fx: number;
  fy: number;
  rPx: number;
  palette: string[];
}> = ({ fx, fy, rPx, palette }) => {
  const WEDGES = 36;
  const wedges: React.ReactNode[] = [];
  const reach = rPx * 1.6;
  // Fan opens 180° downward (PI..2PI).
  const open = Math.PI;
  const start = 0; // 0 rad = right; SVG y-down means PI/2 = down
  // We want to open toward positive Y (down). Angles: PI/2 - PI/2 .. PI/2 + PI/2 = 0..PI
  for (let w = 0; w < WEDGES; w++) {
    const a0 = start + (w / WEDGES) * open;
    const a1 = start + ((w + 1) / WEDGES) * open;
    const p1 = { x: fx + Math.cos(a0) * reach, y: fy + Math.sin(a0) * reach };
    const p2 = { x: fx + Math.cos(a1) * reach, y: fy + Math.sin(a1) * reach };
    const fill = palette[w % palette.length];
    wedges.push(
      <path
        key={w}
        d={`M ${fx} ${fy} L ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A ${reach} ${reach} 0 0 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} Z`}
        fill={fill}
      />,
    );
  }
  return (
    <g>
      {wedges}
      <circle cx={fx} cy={fy} r={rPx * 0.06} fill={palette[0]} />
    </g>
  );
};

export const GridMatchCardSplitStyle: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const cellW = PANEL_BOUNDS.width / COLS;
  const cellH = PANEL_BOUNDS.height / TOTAL_ROWS;
  const baseSize = Math.min(cellW, cellH) * 0.34;
  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;

  const resolved: ResolvedGoal[] = goals.map((g) => {
    const triggerFrame = minuteToFrame(g.minute);
    const halfCol = g.cell % 5;
    const halfRow = Math.floor(g.cell / 5);
    const focalCol = halfCol * (COLS / 5) + COLS / 10;
    const focalRowInHalf = halfRow * (ROWS_PER_SIDE / 4) + ROWS_PER_SIDE / 8;
    const focalRow =
      g.team === "home" ? focalRowInHalf : focalRowInHalf + ROWS_PER_SIDE;
    return { goal: g, triggerFrame, focalCol, focalRow };
  });

  // Big enough that a single bloom can cover its entire team-half from
  // any plausible focal cell (half diagonal ≈ 24 cells; we go further so
  // late-firing goals still fully wash the half).
  const BASE_RADIUS = 48;
  const ENTER_DUR = 36;
  const reveals = resolved.map((rg) => {
    const local = frame - rg.triggerFrame;
    if (local < 0) return 0;
    const t = Math.min(1, local / ENTER_DUR);
    const eased = 1 - Math.pow(1 - t, 3);
    return eased * BASE_RADIUS;
  });

  // Sub-pulse texture cells (low alpha breathing).
  const cells: React.ReactNode[] = [];
  for (let row = 0; row < TOTAL_ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cellCenterX = PANEL_BOUNDS.left + col * cellW + cellW / 2;
      const cellCenterY = PANEL_BOUNDS.top + row * cellH + cellH / 2;
      const driftPhase = col * 0.42 + row * 0.31 + frame * 0.22;
      const driftX = Math.sin(driftPhase) * 1.0;
      const driftY = Math.cos(driftPhase * 1.07) * 1.0;
      const livePhase = (col + row * 0.6) * 0.18 - frame * 0.26;
      const live = 0.5 + 0.5 * Math.sin(livePhase);
      let waveBoost = 0;
      for (let i = 0; i < resolved.length; i++) {
        const rg = resolved[i];
        const localG = frame - rg.triggerFrame;
        if (localG < 0) continue;
        const ddx = col - rg.focalCol;
        const ddy = row - rg.focalRow;
        const dist = Math.hypot(ddx, ddy);
        const wavePhase = localG * 0.42 - dist * 0.6;
        const reachedAt = dist / 0.7;
        const sinceReached = Math.max(0, localG - reachedAt);
        const reachDecay = Math.exp(-sinceReached * 0.03);
        const distDecay = 1 / (1 + dist * 0.05);
        const w = Math.sin(wavePhase) * reachDecay * distDecay;
        waveBoost += w;
      }
      const inHomeHalf = row < ROWS_PER_SIDE;
      const tone = inHomeHalf ? "#0e0e0e" : "#FFFFFF";
      const opacity = Math.max(
        0,
        Math.min(0.4, 0.04 + live * 0.10 + Math.abs(waveBoost) * 0.35),
      );
      const size = baseSize * (0.85 + live * 0.35 + Math.abs(waveBoost) * 0.7);
      cells.push(
        <rect
          key={`${col}-${row}`}
          x={cellCenterX - size / 2 + driftX}
          y={cellCenterY - size / 2 + driftY}
          width={size}
          height={size}
          fill={tone}
          opacity={opacity}
        />,
      );
    }
  }

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

  // Real team colours drive both halves now.
  const HOME_PRIMARY = home.flagPrimary;
  const HOME_ACCENT = home.flagAccent;
  const AWAY_PALETTE = [
    away.flagPrimary,
    away.flagSecondary,
    away.flagAccent,
  ];

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
          <clipPath id="panel-clip-split">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
          {/* Feathered half MASKS — the boundary fades over a band around
              the midline so the two visual languages bleed into each other
              instead of meeting on a hard line. */}
          <linearGradient
            id="home-fade"
            x1="0"
            y1={PANEL_BOUNDS.top}
            x2="0"
            y2={midY + 80}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.78" stopColor="#ffffff" />
            <stop offset="1" stopColor="#000000" />
          </linearGradient>
          <linearGradient
            id="away-fade"
            x1="0"
            y1={midY - 80}
            x2="0"
            y2={PANEL_BOUNDS.bottom}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#000000" />
            <stop offset="0.22" stopColor="#ffffff" />
            <stop offset="1" stopColor="#ffffff" />
          </linearGradient>
          <mask id="home-half-mask">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
              fill="url(#home-fade)"
            />
          </mask>
          <mask id="away-half-mask">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
              fill="url(#away-fade)"
            />
          </mask>
          {/* Goo / metaball filter — the edges of every shape (sunburst
              wedges, shard fans, concentric rings) gain a gaussian-blurred
              halo, snapped back to crisp via an alpha threshold. Adjacent
              wedges merge; same-half blooms fuse; the geometry reads as
              fluid rather than rigid. */}
          <filter id="split-goo" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 22 -10"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
        <g clipPath="url(#panel-clip-split)">
          {/* HOME-half blooms — sunburst, fluid via goo filter, faded
              into the midline via the home mask so it bleeds into the
              away half rather than meeting on a hard cut. */}
          <g mask="url(#home-half-mask)" filter="url(#split-goo)">
            {resolved.map((rg, i) => {
              if (rg.goal.team !== "home" || reveals[i] <= 0.001) return null;
              const fx = PANEL_BOUNDS.left + rg.focalCol * cellW + cellW / 2;
              const fy = PANEL_BOUNDS.top + rg.focalRow * cellH + cellH / 2;
              const rPx = reveals[i] * Math.min(cellW, cellH);
              return (
                <SunburstHome
                  key={`h-${i}`}
                  fx={fx}
                  fy={fy}
                  rPx={rPx}
                  primary={HOME_PRIMARY}
                  accent={HOME_ACCENT}
                />
              );
            })}
          </g>
          {/* AWAY-half blooms — shard fan, same fluid treatment with the
              away mask + goo so the two visual languages meet in a soft
              braided band around the midline. */}
          <g mask="url(#away-half-mask)" filter="url(#split-goo)">
            {resolved.map((rg, i) => {
              if (rg.goal.team !== "away" || reveals[i] <= 0.001) return null;
              const fx = PANEL_BOUNDS.left + rg.focalCol * cellW + cellW / 2;
              const fy = PANEL_BOUNDS.top + rg.focalRow * cellH + cellH / 2;
              const rPx = reveals[i] * Math.min(cellW, cellH);
              return (
                <ShardFanAway
                  key={`a-${i}`}
                  fx={fx}
                  fy={fy}
                  rPx={rPx}
                  palette={AWAY_PALETTE}
                />
              );
            })}
          </g>
          {/* breathing-cell texture rides on top */}
          {cells}
        </g>
      </svg>
      <ScoreNumeral
        value={homeScoreNow}
        color={HOME_ACCENT}
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
        color="#FFFFFF"
        cx={cx}
        cy={(midY + PANEL_BOUNDS.bottom) / 2}
        bumpFrame={lastAwayBump}
        sweepFrames={8}
        sweepDirection="horizontal"
        outlineColor="#0e0e0e"
        outlineWidth={10}
      />
    </AbsoluteFill>
  );
};

export { matchCardSchema };
