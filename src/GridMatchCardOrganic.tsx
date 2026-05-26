import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

const COLS = 30;
const ROWS_PER_SIDE = 30;
const TOTAL_ROWS = ROWS_PER_SIDE * 2;
const HOLE_COLOR = "#F1EEE7"; // pitch cream — used for negative-space droplets

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalCol: number;
  focalRow: number;
  primary: string;
};

// Tiny seeded PRNG so droplet positions are stable per goal index.
const seededRandom = (seed: number): (() => number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
};

/**
 * Organic blob bloom — solid team-coloured shape with a wavy outer boundary,
 * filled with a halftone dot pattern and scattered larger cream droplets.
 * Reference: organic op-art / "leopard" inkblot poster aesthetic.
 */
const BloomBlob: React.FC<{
  rg: ResolvedGoal;
  revealRadius: number;
  cellW: number;
  cellH: number;
  panelLeft: number;
  panelTop: number;
  distortion: { skewX: number; skewY: number; rotation: number };
  index: number;
}> = ({
  rg,
  revealRadius,
  cellW,
  cellH,
  panelLeft,
  panelTop,
  distortion,
  index,
}) => {
  if (revealRadius <= 0.001) return null;

  const fx = panelLeft + rg.focalCol * cellW + cellW / 2;
  const fy = panelTop + rg.focalRow * cellH + cellH / 2;
  const cellSize = Math.min(cellW, cellH);
  const rPx = revealRadius * cellSize;
  const { primary } = rg;
  const seed = rg.triggerFrame + index * 919 + rg.goal.style * 47;

  // Wavy blob outline — two layered sine perturbations on the radius give
  // an organic, non-circular silhouette.
  const N = 96;
  const outline: string[] = [];
  for (let k = 0; k <= N; k++) {
    const a = (k / N) * Math.PI * 2;
    const wob =
      Math.sin(a * 4 + seed * 0.013) * (rPx * 0.16) +
      Math.sin(a * 9 + seed * 0.019) * (rPx * 0.06) +
      Math.sin(a * 13 + seed * 0.023) * (rPx * 0.03);
    const r = rPx + wob;
    const px = fx + Math.cos(a) * r;
    const py = fy + Math.sin(a) * r;
    outline.push(`${k === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`);
  }
  outline.push("Z");
  const blobPath = outline.join(" ");

  // Scattered organic droplets inside the blob — varying sizes, organic
  // wavy boundaries (not perfect circles).
  const rng = seededRandom(seed);
  const DROPS = 14;
  const droplets: React.ReactNode[] = [];
  for (let i = 0; i < DROPS; i++) {
    const ang = rng() * Math.PI * 2;
    const dist = Math.sqrt(rng()) * rPx * 0.78;
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist;
    const baseR = rPx * (0.04 + rng() * 0.11);
    const dropPts: string[] = [];
    const M = 32;
    const dropSeed = rng() * 100;
    for (let k = 0; k <= M; k++) {
      const a = (k / M) * Math.PI * 2;
      const w =
        Math.sin(a * 3 + dropSeed) * baseR * 0.18 +
        Math.sin(a * 5 + dropSeed * 1.4) * baseR * 0.08;
      const r = baseR + w;
      const px = fx + dx + Math.cos(a) * r;
      const py = fy + dy + Math.sin(a) * r;
      dropPts.push(`${k === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`);
    }
    dropPts.push("Z");
    droplets.push(
      <path key={`d-${i}`} d={dropPts.join(" ")} fill={HOLE_COLOR} />,
    );
  }

  // Per-bloom clip path id — used so the halftone rect is bounded by the
  // organic outline.
  const clipId = `blob-clip-${rg.triggerFrame}-${rg.goal.style}-${index}`;
  // Per-bloom halftone pattern id (so the dot color stays cream against
  // the team primary fill).
  const patId = `blob-halftone-${rg.triggerFrame}-${rg.goal.style}-${index}`;

  const { skewX, skewY, rotation } = distortion;
  const transform = `translate(${fx} ${fy}) rotate(${rotation}) skewX(${skewX}) skewY(${skewY}) translate(${-fx} ${-fy})`;

  // Halftone bounding box that comfortably covers the blob.
  const boxX = fx - rPx * 1.4;
  const boxY = fy - rPx * 1.4;
  const boxSize = rPx * 2.8;

  return (
    <g transform={transform}>
      <defs>
        <clipPath id={clipId}>
          <path d={blobPath} />
        </clipPath>
        <pattern
          id={patId}
          x="0"
          y="0"
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="8" cy="8" r="2.4" fill={HOLE_COLOR} />
        </pattern>
      </defs>
      <path d={blobPath} fill={primary} />
      <g clipPath={`url(#${clipId})`}>
        <rect
          x={boxX}
          y={boxY}
          width={boxSize}
          height={boxSize}
          fill={`url(#${patId})`}
          opacity={0.85}
        />
        {droplets}
      </g>
    </g>
  );
};

export const GridMatchCardOrganic: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const cellW = PANEL_BOUNDS.width / COLS;
  const cellH = PANEL_BOUNDS.height / TOTAL_ROWS;
  const baseSize = Math.min(cellW, cellH) * 0.34;

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

  const BASE_RADIUS = 16;
  const ENTER_DUR = 36;
  const DISTORT_DUR = 28;

  const reveals = resolved.map((rg) => {
    const local = frame - rg.triggerFrame;
    if (local < 0) return 0;
    const t = Math.min(1, local / ENTER_DUR);
    const eased = 1 - Math.pow(1 - t, 3);
    return eased * BASE_RADIUS;
  });

  const distortions = resolved.map((_, i) => {
    let skewX = 0;
    let skewY = 0;
    let rotation = 0;
    for (let j = i + 1; j < resolved.length; j++) {
      const laterLocal = frame - resolved[j].triggerFrame;
      if (laterLocal < 0) break;
      const sP = Math.min(1, laterLocal / DISTORT_DUR);
      const sEased = 1 - Math.pow(1 - sP, 3);
      const sign = j % 2 === 0 ? 1 : -1;
      skewX += 11 * sEased * sign;
      skewY += 7 * sEased * -sign;
      rotation += 5 * sEased * sign;
    }
    return { skewX, skewY, rotation };
  });

  const cells: React.ReactNode[] = [];
  for (let row = 0; row < TOTAL_ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cellCenterX = PANEL_BOUNDS.left + col * cellW + cellW / 2;
      const cellCenterY = PANEL_BOUNDS.top + row * cellH + cellH / 2;

      const driftPhase = col * 0.42 + row * 0.31 + frame * 0.22;
      const driftX = Math.sin(driftPhase) * 1.2;
      const driftY = Math.cos(driftPhase * 1.07) * 1.2;

      const livePhase = (col + row * 0.6) * 0.18 - frame * 0.26;
      const swell = Math.sin(frame * 0.11 + (col - row) * 0.04);
      const live = 0.5 + 0.5 * Math.sin(livePhase);

      let waveBoost = 0;
      let pushX = 0;
      let pushY = 0;
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
        if (dist > 0.001) {
          pushX += (ddx / dist) * w * 4;
          pushY += (ddy / dist) * w * 4;
        }
      }

      const opacity = Math.max(
        0,
        Math.min(
          1,
          0.10 + live * 0.18 + swell * 0.04 + Math.abs(waveBoost) * 0.55,
        ),
      );
      const size = baseSize * (0.85 + live * 0.35 + Math.abs(waveBoost) * 0.9);

      const cellColor =
        row < ROWS_PER_SIDE ? home.flagPrimary : away.flagPrimary;

      cells.push(
        <rect
          key={`${col}-${row}`}
          x={cellCenterX - size / 2 + driftX + pushX}
          y={cellCenterY - size / 2 + driftY + pushY}
          width={size}
          height={size}
          fill={cellColor}
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
  const midY = (PANEL_BOUNDS.top + PANEL_BOUNDS.bottom) / 2;

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
          <clipPath id="panel-clip-organic">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
          <filter
            id="bloom-goo-organic"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="22" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 24 -10"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
        {cells}
        <g
          clipPath="url(#panel-clip-organic)"
          filter="url(#bloom-goo-organic)"
        >
          {resolved.map((rg, i) => (
            <BloomBlob
              key={`bloom-${i}`}
              rg={rg}
              revealRadius={reveals[i]}
              cellW={cellW}
              cellH={cellH}
              panelLeft={PANEL_BOUNDS.left}
              panelTop={PANEL_BOUNDS.top}
              distortion={distortions[i]}
              index={i}
            />
          ))}
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
