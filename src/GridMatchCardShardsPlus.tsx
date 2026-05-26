import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { line, curveBasis } from "d3-shape";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { ScoreNumeral } from "./components/ScoreNumeral";
import { fonts } from "./lib/theme";
import { matchCardSchema } from "./schema";
import type { MatchCardProps, Goal } from "./schema";
import { minuteToFrame } from "./lib/timing";

// Scorer roster keyed by goal-array index for the default 3-2 ENG vs BRA
// scenario this composition uses. Index n in resolved[] → scorer SCORERS[n].
const SCORERS: string[] = [
  "J. BELLINGHAM",
  "H. KANE",
  "VINÍCIUS JR.",
  "RODRYGO",
  "H. KANE",
];

// Op-art shard fan — each goal is a dense radial burst of narrow
// alternating wedges fanning from an off-centre focal point, plus a
// short band of perspective-tilted checker rectangles on the opposite
// side. Reference: Vasarely / Riley shard composition.

// Two reference SVG paths — flowing horizontal organic patterns the
// user provided. Rendered as embedded shapes per goal: scaled to the
// bloom's reveal radius, filled in the team's palette, dropped at the
// focal point as one of the goal primitives.
const REF_PATH_1 = {
  w: 202,
  h: 291,
  d: "M34.6253 0.609039C35.3463 0.898039 36.2093 0.862029 36.5413 0.530029C36.8733 0.198029 36.2833 -0.0379646 35.2293 0.0050354C34.0643 0.0530354 33.8273 0.290039 34.6253 0.609039ZM105.625 0.609039C106.346 0.898039 107.209 0.862029 107.541 0.530029C107.873 0.198029 107.283 -0.0379646 106.229 0.0050354C105.064 0.0530354 104.827 0.290039 105.625 0.609039ZM193.206 2.92401C193.264 4.57201 193.797 5.92201 194.389 5.92401C195.017 5.92501 195.282 4.67503 195.025 2.92603C194.454 -0.966974 193.067 -0.967989 193.206 2.92401ZM0.89032 19.332C-0.51968 21.031 0.230317 22.926 2.31232 22.926C4.47732 22.926 5.19633 20.882 3.59433 19.28C2.32233 18.008 1.98432 18.014 0.89032 19.332ZM14.9023 37.0821C15.7876 38.2505 17.3916 38.8744 20.2973 40.049C23.2373 41.237 24.3923 42.323 24.6103 44.103C24.9943 47.243 21.4163 51.776 17.1443 53.561C14.4163 54.701 13.8123 55.498 13.8123 57.958C13.8123 60.555 14.1183 60.897 16.0623 60.471C29.1983 57.591 36.0653 55.753 40.0083 54.06C44.0723 52.315 44.8513 51.495 45.8023 47.962C46.4073 45.717 46.6233 43.429 46.2823 42.878C45.9423 42.327 42.4343 40.269 38.4883 38.304C29.6153 33.887 27.8633 31.827 27.8343 25.774C27.8143 21.463 27.5813 21.041 24.6633 20.024C22.9313 19.42 19.7813 18.926 17.6633 18.926H13.8123V27.867C13.8123 33.2692 13.7859 35.6087 14.9023 37.0821ZM51.1613 20.26C53.8483 21.318 53.9773 21.638 53.4323 25.904C52.6793 31.811 54.4363 34.082 63.4083 38.8C70.2513 42.398 70.3103 42.464 70.0773 46.307C69.6363 53.578 67.6123 54.521 39.4693 60.568C19.163 64.931 14.9181 65.7772 14.0383 67.9722C13.778 68.6217 13.8123 69.3893 13.8123 70.401C13.8123 72.34 14.0143 73.926 14.2623 73.926C14.5093 73.926 21.1463 72.075 29.0123 69.813C46.2863 64.844 55.9343 62.476 69.8123 59.795C81.9373 57.454 91.5513 54.437 94.0623 52.185C95.1933 51.171 95.8123 49.155 95.8123 46.481C95.8123 42.395 95.7313 42.303 88.9193 38.624C80.5463 34.101 78.4093 31.273 79.3143 25.913C80.3103 20.019 77.3443 18.897 61.1123 19.032C50.5543 19.12 48.8113 19.335 51.1613 20.26Z",
};
const REF_PATH_2 = {
  w: 201,
  h: 285,
  d: "M100.5 1.08862C100.84 1.63862 101.568 2.08862 102.118 2.08862C102.668 2.08862 102.84 1.63862 102.5 1.08862C102.16 0.538623 101.432 0.088623 100.882 0.088623C100.332 0.088623 100.16 0.538623 100.5 1.08862ZM14.75 18.7836C10.036 19.9996 14.35 20.9086 27.75 21.5236C35.862 21.8956 49.554 22.8466 58.176 23.6356C66.798 24.4256 82.323 25.5176 92.676 26.0626C117.752 27.3836 124.102 28.0466 126.582 29.6056C128.974 31.1096 138.222 32.2606 170.5 35.0736C183.15 36.1766 195.188 37.3446 197.25 37.6716C200.894 38.2476 201 38.1786 201 35.2106C201 32.3016 200.764 32.1266 196 31.4946C190.179 30.7216 189.296 29.0886 194.7 29.0886C196.807 29.0886 197.991 28.7226 197.45 28.2396C196.927 27.7726 190.253 26.8356 182.618 26.1576C159.844 24.1346 160.858 22.5086 185.559 21.4436C197.126 20.9446 201 20.4556 201 19.4926C201 18.4546 183.268 18.2196 108.75 18.2696C58.012 18.3046 15.712 18.5356 14.75 18.7836ZM30.534 60.2186C26.983 61.1146 21.586 62.1596 18.539 62.5406C13.006 63.2316 13 63.2356 13 66.7376V70.2426L54.75 69.9156C94.139 69.6066 101.241 69.1236 97.857 66.9786C97.111 66.5056 95.375 66.0806 94 66.0336C91.72 65.9556 91.676 65.8756 93.5 65.1256C95.093 64.4706 95.194 64.1936 94 63.7656C90.391 62.4716 67.195 59.9646 52.745 59.3066C39.75 58.7146 35.858 58.8746 30.534 60.2186Z",
};

const COLS = 30;
const ROWS_PER_SIDE = 30;
const TOTAL_ROWS = ROWS_PER_SIDE * 2;

type ResolvedGoal = {
  goal: Goal;
  triggerFrame: number;
  focalCol: number;
  focalRow: number;
  /** Per-team palette cycled through wedges + checker cells. */
  palette: string[];
};

const buildPath = line<{ x: number; y: number }>()
  .x((d) => d.x)
  .y((d) => d.y)
  .curve(curveBasis);

/**
 * Dense narrow-wedge fan radiating from a focal anchored OFF the
 * bloom centre, plus a short perspective-tilted checker band on the
 * opposite side. Rendered as straight-edged paths so the silhouette
 * is sharp like the source image.
 */
type Neighbour = { x: number; y: number; r: number };

const ShardFan: React.FC<{
  cx: number;
  cy: number;
  rPx: number;
  palette: string[];
  index: number;
  /** Other live focal points + radii — used to distort this shape when
   *  another bloom touches its territory. */
  others: Neighbour[];
}> = ({ cx, cy, rPx, palette: rawPalette, index, others }) => {
  // Strip near-white palette entries before anything renders — white-on-
  // cream is invisible, so a two-tone flag like England's (red + white)
  // would otherwise produce wedges that disappear into the pitch.
  const palette = (() => {
    const filtered = rawPalette.filter((c) => {
      const m = c.replace("#", "");
      if (m.length < 6) return true;
      const r = parseInt(m.slice(0, 2), 16);
      const g = parseInt(m.slice(2, 4), 16);
      const b = parseInt(m.slice(4, 6), 16);
      return r + g + b < 720;
    });
    return filtered.length > 0 ? filtered : rawPalette;
  })();
  // Contact-driven distortion — every neighbour pulls the shape's
  // sample point HARD toward (or away from) the neighbour's focal once
  // the bloom radii overlap. The force scales with how far this point
  // sits from the shape's own anchor, so the wedge anchor barely moves
  // while the tips swing dramatically — the shape actually deforms
  // instead of translating wholesale.
  const distort = (x: number, y: number): { x: number; y: number } => {
    let dx = 0;
    let dy = 0;
    // Distance of THIS point from the bloom's own focal — used to
    // bias deformation toward the silhouette edges.
    const ownDx = x - cx;
    const ownDy = y - cy;
    const ownDist = Math.hypot(ownDx, ownDy);
    const tipBias = Math.min(1, ownDist / Math.max(rPx, 1));

    for (const o of others) {
      const vx = o.x - x;
      const vy = o.y - y;
      const d = Math.hypot(vx, vy);
      if (d < 1) continue;

      // Long-range hint that ramps up to full contact-drama.
      const sumR = o.r + rPx;
      let intensity = 0;
      if (d <= sumR) {
        // Hard contact — overlap-based force.
        const overlap = (sumR - d) / Math.max(sumR, 1);
        intensity = 0.45 + overlap * 1.2; // 0.45..1.65
      } else if (d <= sumR * 1.4) {
        // Pre-contact whisper — gentle attraction.
        const tail = 1 - (d - sumR) / (sumR * 0.4);
        intensity = tail * 0.25;
      }

      if (intensity <= 0) continue;
      // Forces dialed down — shapes nudge each other on contact
      // without losing their angular silhouette.
      const force = intensity * 40 * (0.3 + tipBias * 0.6);

      const polarity = (index + (o.x + o.y > 0 ? 1 : 0)) % 2 === 0 ? 1 : -1;
      dx += (vx / d) * force * polarity;
      dy += (vy / d) * force * polarity;

      // Swirl trimmed back so rotation reads as a slight lean, not a
      // full curl.
      const swirl = intensity * 18 * tipBias * polarity;
      dx += (-vy / d) * swirl;
      dy += (vx / d) * swirl;
    }
    return { x: x + dx, y: y + dy };
  };

  // Per-goal SHAPE-TYPE variation. Each index picks an entirely
  // different visual primitive — fan, ripples, ribbons, halftone disc,
  // cross-hatch, vortex, scanlines — so adjacent blooms don't read as
  // colour swaps of the same form.
  const shapeType = index % 7;

  // ─── 0 — wedge fan + perspective checker ──────────────────────────
  const renderFan = (): React.ReactNode => {
    const sign = index % 4 < 2 ? 1 : -1;
    const ax = cx + rPx * 0.55 * sign;
    const ay = cy;
    const reach = rPx * 2.2;
    const WEDGES = 24;
    const open = 3.49;
    const startAng = sign > 0 ? Math.PI - open / 2 : -open / 2;

    const wedges: React.ReactNode[] = [];
    const a0Anchor = distort(ax, ay);
    for (let w = 0; w < WEDGES; w++) {
      const a0 = startAng + (w / WEDGES) * open;
      const a1 = startAng + ((w + 1) / WEDGES) * open;
      const p1 = distort(ax + Math.cos(a0) * reach, ay + Math.sin(a0) * reach);
      const p2 = distort(ax + Math.cos(a1) * reach, ay + Math.sin(a1) * reach);
      if (w % 2 !== 0) continue;
      const fill = palette[(w / 2) % palette.length];
      wedges.push(
        <path
          key={`w-${w}`}
          d={`M ${a0Anchor.x.toFixed(1)} ${a0Anchor.y.toFixed(1)} L ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} Z`}
          fill={fill}
        />,
      );
    }
    return <g>{wedges}</g>;
  };

  // ─── 1 — multi-source ripple interference ────────────────────────
  // Three off-centre sub-foci each emit concentric rings; where the
  // rings cross they produce the moiré field the reference image
  // shows. Skip near-white palette entries so two-tone flags (e.g.
  // England red + white) still paint a visible bloom against cream.
  const visiblePalette = palette.filter((c) => {
    const m = c.replace("#", "");
    if (m.length < 6) return true;
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    return r + g + b < 720; // drop anything that would vanish into cream
  });
  const inkPalette = visiblePalette.length > 0 ? visiblePalette : palette;

  const renderRipples = (): React.ReactNode => {
    const subFoci = [
      { x: cx - rPx * 0.55, y: cy - rPx * 0.45 },
      { x: cx + rPx * 0.4, y: cy - rPx * 0.55 },
      { x: cx + rPx * 0.1, y: cy + rPx * 0.5 },
    ];
    const rings: React.ReactNode[] = [];
    const N = 64;
    subFoci.forEach((sub, fi) => {
      const RINGS = 14;
      for (let i = 1; i <= RINGS; i++) {
        const t = i / RINGS;
        const ringR = rPx * 1.1 * Math.pow(t, 1.4);
        if (ringR < 2) continue;
        const pts: { x: number; y: number }[] = [];
        for (let k = 0; k <= N; k++) {
          const a = (k / N) * Math.PI * 2;
          pts.push(
            distort(sub.x + Math.cos(a) * ringR, sub.y + Math.sin(a) * ringR),
          );
        }
        pts.push(pts[0]);
        // Stroke widths bumped so the goo filter's alpha threshold
        // doesn't eat thin lines.
        const sw = i % 2 === 0 ? 8 : 14;
        rings.push(
          <path
            key={`r-${fi}-${i}`}
            d={buildPath(pts) ?? ""}
            fill="none"
            stroke={inkPalette[(fi + i) % inkPalette.length]}
            strokeWidth={sw}
          />,
        );
      }
    });
    return <g>{rings}</g>;
  };

  // ─── 2 — wavy horizontal ribbons (Riley `Fall` / `Cataract`) ─────
  const renderRibbons = (): React.ReactNode => {
    const ROWS = 16;
    const span = rPx * 1.9;
    const out: React.ReactNode[] = [];
    for (let s = 0; s < ROWS; s++) {
      const t = s / (ROWS - 1);
      // Saddle amplitude — fat in the middle of the field, hairlines
      // at top + bottom (the silhouette of Riley's wave compositions).
      const ampScale = Math.sin(Math.PI * t);
      const amp = rPx * 0.32 * (0.18 + ampScale * 0.95);
      const yBase = cy - rPx * 1.05 + t * rPx * 2.1;
      const N = 48;
      const pts: { x: number; y: number }[] = [];
      for (let k = 0; k <= N; k++) {
        const u = k / N;
        const x = cx - span + u * span * 2;
        // Compound wave — primary swell + secondary modulation, with
        // per-row phase drift creating the optical illusion.
        const y =
          yBase +
          Math.sin((u - 0.5) * 5.2 + s * 0.46) * amp +
          Math.sin((u - 0.5) * 11 + s * 0.93) * amp * 0.22;
        pts.push(distort(x, y));
      }
      out.push(
        <path
          key={`rb-${s}`}
          d={buildPath(pts) ?? ""}
          fill="none"
          stroke={palette[s % palette.length]}
          strokeWidth={4 + ampScale * 22}
          strokeLinecap="butt"
        />,
      );
    }
    return <g>{out}</g>;
  };

  // ─── 3 — halftone-dot disc ────────────────────────────────────────
  const renderHalftone = (): React.ReactNode => {
    const dots: React.ReactNode[] = [];
    const STEP = rPx * 0.16;
    const cols = Math.ceil((rPx * 2) / STEP);
    for (let r = -cols; r <= cols; r++) {
      for (let c = -cols; c <= cols; c++) {
        const x = cx + c * STEP + (r % 2 === 0 ? 0 : STEP / 2);
        const y = cy + r * STEP * 0.85;
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > rPx) continue;
        const radius = (1 - dist / rPx) * STEP * 0.55;
        const p = distort(x, y);
        dots.push(
          <circle
            key={`d-${r}-${c}`}
            cx={p.x}
            cy={p.y}
            r={radius}
            fill={palette[(Math.abs(r) + Math.abs(c)) % palette.length]}
          />,
        );
      }
    }
    return <g>{dots}</g>;
  };

  // ─── Spoon-poster warped checker ──────────────────────────────────
  // A checker pattern that twists around the focal — every cell's
  // position is rotated by an angle proportional to its distance from
  // the centre, so the regular grid spirals near the middle and
  // straightens out at the rim.
  const renderWarpedChecker = (): React.ReactNode => {
    const cells: React.ReactNode[] = [];
    const STEP = rPx * 0.18;
    const half = Math.ceil(rPx / STEP);
    for (let r = -half; r <= half; r++) {
      for (let c = -half; c <= half; c++) {
        const x0 = c * STEP;
        const y0 = r * STEP;
        const dist = Math.hypot(x0, y0);
        if (dist > rPx) continue;
        // Twist factor — stronger near centre, vanishing at rim.
        const twist = (1 - dist / rPx) * 2.4;
        const rot = twist;
        const sinR = Math.sin(rot);
        const cosR = Math.cos(rot);
        // Four corners of the cell rotated by `rot` around the focal.
        const corners = [
          { x: x0, y: y0 },
          { x: x0 + STEP, y: y0 },
          { x: x0 + STEP, y: y0 + STEP },
          { x: x0, y: y0 + STEP },
        ].map((p) =>
          distort(
            cx + p.x * cosR - p.y * sinR,
            cy + p.x * sinR + p.y * cosR,
          ),
        );
        if ((r + c) % 2 !== 0) continue;
        const fill = palette[(Math.abs(r) + Math.abs(c)) % palette.length];
        cells.push(
          <path
            key={`wc-${r}-${c}`}
            d={`M ${corners[0].x.toFixed(1)} ${corners[0].y.toFixed(1)} L ${corners[1].x.toFixed(1)} ${corners[1].y.toFixed(1)} L ${corners[2].x.toFixed(1)} ${corners[2].y.toFixed(1)} L ${corners[3].x.toFixed(1)} ${corners[3].y.toFixed(1)} Z`}
            fill={fill}
          />,
        );
      }
    }
    return <g>{cells}</g>;
  };

  // ─── 4 — diagonal cross-hatch ─────────────────────────────────────
  const renderCrossHatch = (): React.ReactNode => {
    const hatches: React.ReactNode[] = [];
    const STRIPES = 14;
    const span = rPx * 1.7;
    for (const angle of [Math.PI / 4, -Math.PI / 4]) {
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      for (let s = 0; s < STRIPES; s++) {
        const t = s / (STRIPES - 1);
        const offset = (t - 0.5) * span * 2;
        const aLen = Math.sqrt(rPx * rPx - offset * offset);
        if (!isFinite(aLen) || aLen <= 0) continue;
        const start = distort(
          cx + cosA * -aLen + -sinA * offset,
          cy + sinA * -aLen + cosA * offset,
        );
        const end = distort(
          cx + cosA * aLen + -sinA * offset,
          cy + sinA * aLen + cosA * offset,
        );
        hatches.push(
          <line
            key={`h-${angle}-${s}`}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={palette[s % palette.length]}
            strokeWidth={5}
            strokeLinecap="butt"
          />,
        );
      }
    }
    return <g>{hatches}</g>;
  };

  // ─── 5 — radial vortex: rays + concentric grid converging inward ───
  const renderVortex = (): React.ReactNode => {
    const out: React.ReactNode[] = [];
    // 36 radial rays converging on the focal centre.
    const RAYS = 36;
    for (let k = 0; k < RAYS; k++) {
      const a = (k / RAYS) * Math.PI * 2;
      const fill = k % 2 === 0 ? palette[0] : palette[palette.length - 1];
      // Each ray is a long thin triangle from rim to centre — narrow at
      // the centre (vanishing point) and widening at the rim.
      const aNarrow = a + 0.012;
      const tip = distort(cx, cy);
      const outerA = distort(
        cx + Math.cos(a) * rPx,
        cy + Math.sin(a) * rPx,
      );
      const outerB = distort(
        cx + Math.cos(aNarrow) * rPx,
        cy + Math.sin(aNarrow) * rPx,
      );
      out.push(
        <path
          key={`v-r-${k}`}
          d={`M ${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L ${outerA.x.toFixed(1)} ${outerA.y.toFixed(1)} L ${outerB.x.toFixed(1)} ${outerB.y.toFixed(1)} Z`}
          fill={fill}
        />,
      );
    }
    // 5 concentric ring outlines for the grid-like fragmented structure.
    for (let r = 1; r <= 5; r++) {
      const t = r / 5;
      const ringR = rPx * Math.pow(t, 1.35);
      if (ringR < 1) continue;
      const pts: { x: number; y: number }[] = [];
      const N = 48;
      for (let k = 0; k <= N; k++) {
        const a = (k / N) * Math.PI * 2;
        pts.push(distort(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR));
      }
      out.push(
        <path
          key={`v-c-${r}`}
          d={(buildPath(pts) ?? "") + " Z"}
          fill="none"
          stroke="#0e0e0e"
          strokeOpacity={0.55}
          strokeWidth={2}
        />,
      );
    }
    return <g>{out}</g>;
  };

  // ─── 6 — horizontal modular scanline stripes ──────────────────────
  const renderScanlines = (): React.ReactNode => {
    const out: React.ReactNode[] = [];
    // Variable-width bars stacked vertically; widths sampled from a
    // deterministic pseudo-random sequence so each goal gets a stable
    // "barcode" rhythm.
    const BARS = 22;
    const widths: number[] = [];
    let total = 0;
    for (let s = 0; s < BARS; s++) {
      const u = Math.sin(s * 1.61803 + index * 0.7) * 0.5 + 0.5;
      const w = 0.4 + u * 1.4;
      widths.push(w);
      total += w;
    }
    const span = rPx * 2;
    const xL = cx - rPx * 1.7;
    const xR = cx + rPx * 1.7;
    let yCursor = cy - rPx;
    for (let s = 0; s < BARS; s++) {
      const h = (widths[s] / total) * span;
      // Alternate painted / transparent; painted bars cycle the palette.
      const painted = s % 2 === 0;
      if (painted) {
        const fill = palette[(s / 2) % palette.length];
        // Distort each corner so the bar can bend toward neighbours.
        const tl = distort(xL, yCursor);
        const tr = distort(xR, yCursor);
        const br = distort(xR, yCursor + h);
        const bl = distort(xL, yCursor + h);
        out.push(
          <path
            key={`s-${s}`}
            d={`M ${tl.x.toFixed(1)} ${tl.y.toFixed(1)} L ${tr.x.toFixed(1)} ${tr.y.toFixed(1)} L ${br.x.toFixed(1)} ${br.y.toFixed(1)} L ${bl.x.toFixed(1)} ${bl.y.toFixed(1)} Z`}
            fill={fill}
          />,
        );
      }
      yCursor += h;
    }
    return <g>{out}</g>;
  };

  // Reference-path renderers — embed the user-supplied SVG artwork as
  // a shape primitive. The path is scaled to fit `rPx * 2` and dropped
  // at the focal point; fill cycles through the team palette per goal.
  const renderRefPath = (ref: typeof REF_PATH_1) => (): React.ReactNode => {
    const w = ref.w;
    const h = ref.h;
    const longest = Math.max(w, h);
    const scale = (rPx * 2.1) / longest;
    const dx = cx - (w * scale) / 2;
    const dy = cy - (h * scale) / 2;
    const fill = palette[index % palette.length];
    return (
      <g transform={`translate(${dx}, ${dy}) scale(${scale})`}>
        <path d={ref.d} fill={fill} fillRule="evenodd" />
      </g>
    );
  };
  const renderRefPath1 = renderRefPath(REF_PATH_1);
  const renderRefPath2 = renderRefPath(REF_PATH_2);

  // Parametric primitives first so every goal lands a fully-visible
  // bloom regardless of palette. The reference-path renderers stay in
  // the pool but later in the cycle (they only render the visible
  // slice of their truncated path data so first-goal slots avoid them).
  const renderers = [
    renderFan,             // off-centre wedge fan + perspective checker
    renderRibbons,         // horizontal saddle waves (Riley)
    renderWarpedChecker,   // Spoon-poster spiral checker
    renderRipples,         // multi-source interference
    renderScanlines,       // modular barcode-style stripes
    renderRefPath1,        // organic flowing horizontal pattern (ref 1)
    renderRefPath2,        // dense horizontal striations (ref 2)
  ];
  return <g>{renderers[shapeType % renderers.length]()}</g>;
};

export const GridMatchCardShardsPlus: React.FC<MatchCardProps> = (props) => {
  const frame = useCurrentFrame();
  const { home, away, competition, venue, date, goals } = props;

  const cellW = PANEL_BOUNDS.width / COLS;
  const cellH = PANEL_BOUNDS.height / TOTAL_ROWS;
  const cellSize = Math.min(cellW, cellH);
  const baseSize = cellSize * 0.34;

  const resolved: ResolvedGoal[] = goals.map((g) => {
    const triggerFrame = minuteToFrame(g.minute);
    const halfCol = g.cell % 5;
    const halfRow = Math.floor(g.cell / 5);
    const focalCol = halfCol * (COLS / 5) + COLS / 10;
    const focalRowInHalf = halfRow * (ROWS_PER_SIDE / 4) + ROWS_PER_SIDE / 8;
    const focalRow =
      g.team === "home" ? focalRowInHalf : focalRowInHalf + ROWS_PER_SIDE;
    const team = g.team === "home" ? home : away;
    // Dedupe so a two-colour flag (e.g. England red + white) produces a
    // length-2 palette and the wedge cycle alternates evenly instead of
    // doubling up on one colour.
    const rawPalette = [team.flagPrimary, team.flagSecondary, team.flagAccent];
    const palette = Array.from(new Set(rawPalette.map((c) => c.toLowerCase())));
    return {
      goal: g,
      triggerFrame,
      focalCol,
      focalRow,
      palette,
    };
  });

  const BASE_RADIUS = 14;
  const ENTER_DUR = 36;
  // `reveals[i]` is now a 0..1 progress, not a sized radius. Shapes
  // render at FULL final size and a circular clip mask expands from
  // the focal outward — wavefront reveal instead of scale-up.
  const reveals = resolved.map((rg) => {
    const local = frame - rg.triggerFrame;
    if (local < 0) return 0;
    const t = Math.min(1, local / ENTER_DUR);
    return 1 - Math.pow(1 - t, 3); // ease-out cubic, 0..1
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
      const opacity = Math.max(
        0,
        Math.min(0.4, 0.04 + live * 0.10 + Math.abs(waveBoost) * 0.4),
      );
      const size = baseSize * (0.85 + live * 0.35 + Math.abs(waveBoost) * 0.7);
      cells.push(
        <rect
          key={`${col}-${row}`}
          x={cellCenterX - size / 2 + driftX}
          y={cellCenterY - size / 2 + driftY}
          width={size}
          height={size}
          fill="#0e0e0e"
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
          <clipPath id="panel-clip-shards">
            <rect
              x={PANEL_BOUNDS.left}
              y={PANEL_BOUNDS.top}
              width={PANEL_BOUNDS.width}
              height={PANEL_BOUNDS.height}
            />
          </clipPath>
          {/*
            Two goo filters — calm and chaos. Home (England) uses calm
            so its merges read cleanly; away (Brazil) runs through the
            chaos filter — turbulence warp + bigger blur + softer
            threshold — so its shapes melt and twist into each other
            much more violently.
          */}
          {/*
            Goo filters tightened — smaller blur and harder alpha
            threshold so the merge effect happens at the silhouette
            edges only, preserving the underlying angular geometry
            instead of melting it into soft blobs.
          */}
          {/* Goo blur reduced to a couple of pixels — corners and
              wedge tips read as straight angles, the filter only
              cleans up edge anti-aliasing at silhouette overlap. */}
          <filter
            id="shards-goo"
            x="-3%"
            y="-3%"
            width="106%"
            height="106%"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 40 -18"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
          <filter
            id="shards-goo-chaos"
            x="-4%"
            y="-4%"
            width="108%"
            height="108%"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 34 -16"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
        <g clipPath="url(#panel-clip-shards)">
          {/* Background grid removed — pitch is clean cream. */}
          {(["home", "away"] as const).map((side) => {
            const filterId =
              side === "home" ? "shards-goo" : "shards-goo-chaos";
            // Brazil (away) gets a slightly stronger contact-distortion
            // multiplier so its blooms shove each other a bit more,
            // without veering into pure noise.
            const distortBoost = side === "home" ? 1 : 1.3;
            return (
              <g key={`team-${side}`} filter={`url(#${filterId})`}>
                {resolved.map((rg, i) => {
                  if (rg.goal.team !== side) return null;
                  if (reveals[i] <= 0.001) return null;
                  const fxPanel =
                    PANEL_BOUNDS.left + rg.focalCol * cellW + cellW / 2;
                  const fyPanel =
                    PANEL_BOUNDS.top + rg.focalRow * cellH + cellH / 2;
                  const rPx = BASE_RADIUS * cellSize;
                  const maskR = reveals[i] * rPx * 1.55;
                  const maskId = `wavefront-${i}`;
                  const others = resolved
                    .map((other, j) => {
                      if (j === i || reveals[j] <= 0.001) return null;
                      return {
                        x:
                          PANEL_BOUNDS.left + other.focalCol * cellW + cellW / 2,
                        y:
                          PANEL_BOUNDS.top + other.focalRow * cellH + cellH / 2,
                        r:
                          reveals[j] *
                          BASE_RADIUS *
                          cellSize *
                          distortBoost,
                      };
                    })
                    .filter((p): p is Neighbour => p !== null);
                  return (
                    <g key={i}>
                      <defs>
                        <clipPath id={maskId}>
                          <circle cx={fxPanel} cy={fyPanel} r={maskR} />
                        </clipPath>
                      </defs>
                      <g clipPath={`url(#${maskId})`}>
                        <ShardFan
                          cx={fxPanel}
                          cy={fyPanel}
                          rPx={rPx}
                          palette={rg.palette}
                          index={i}
                          others={others}
                        />
                      </g>
                    </g>
                  );
                })}
              </g>
            );
          })}
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
      {/*
        Scorer name flashes — appear briefly at the centre line on
        every goal trigger. Quick slide-in (6 frames), hold (24), slide-
        out (10). Stack so simultaneous goals don't overwrite each
        other's text.
      */}
      {resolved.map((rg, i) => {
        const local = frame - rg.triggerFrame;
        if (local < 0 || local > 40) return null;
        let opacity = 1;
        let translateY = 0;
        if (local < 6) {
          opacity = local / 6;
          translateY = (1 - local / 6) * 30;
        } else if (local > 30) {
          const t = (local - 30) / 10;
          opacity = 1 - t;
          translateY = -t * 20;
        }
        const scorer = SCORERS[i] ?? `GOAL ${i + 1}`;
        const teamColor =
          rg.goal.team === "home" ? home.flagPrimary : away.flagPrimary;
        // Resized smaller — cap at 88px (was 140), floor at 40, scaled
        // by name length so long names still fit cleanly.
        const nameFontSize = Math.min(
          88,
          Math.max(40, Math.floor(960 / Math.max(1, scorer.length))),
        );
        return (
          <div
            key={`scorer-${i}`}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: midY - 180,
              padding: "0 60px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              transform: `translateY(${translateY}px)`,
              opacity,
              pointerEvents: "none",
              gap: 14,
            }}
          >
            <div
              style={{
                fontFamily: fonts.body,
                fontWeight: 900,
                fontSize: nameFontSize,
                lineHeight: "0.95",
                letterSpacing: "-0.01em",
                color: "#FFFFFF",
                background: teamColor,
                padding: "10px 28px",
                textAlign: "center",
                whiteSpace: "nowrap",
                maxWidth: "100%",
              }}
            >
              {scorer}
            </div>
            <div
              style={{
                fontFamily: fonts.body,
                fontWeight: 800,
                fontSize: 44,
                letterSpacing: "0.18em",
                color: "#FFFFFF",
                background: teamColor,
                padding: "6px 20px",
              }}
            >
              {rg.goal.minute}'
            </div>
          </div>
        );
      })}
      {/*
        Home flag stripe at the top, mirroring the away stripe below —
        both teams now have the same-height flag bar tying their colour
        bands to the title.
      */}
      <div
        style={{
          position: "absolute",
          left: PANEL_BOUNDS.left,
          width: PANEL_BOUNDS.width,
          top: 122,
          display: "flex",
          flexDirection: "row",
          height: 36,
          border: "2px solid #0e0e0e",
        }}
      >
        <div style={{ flex: 1, background: home.flagPrimary }} />
        <div style={{ flex: 1, background: home.flagSecondary }} />
        <div style={{ flex: 1, background: home.flagAccent }} />
      </div>
      <div
        style={{
          position: "absolute",
          left: PANEL_BOUNDS.left,
          right: PANEL_BOUNDS.left,
          width: PANEL_BOUNDS.width,
          bottom: 122,
          display: "flex",
          flexDirection: "row",
          height: 36,
          border: "2px solid #0e0e0e",
        }}
      >
        <div style={{ flex: 1, background: away.flagPrimary }} />
        <div style={{ flex: 1, background: away.flagSecondary }} />
        <div style={{ flex: 1, background: away.flagAccent }} />
      </div>
    </AbsoluteFill>
  );
};

export { matchCardSchema };
