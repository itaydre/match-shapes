import React from "react";

/**
 * Pure SVG goal-shape components. Each renders inside a 100×100 viewBox and
 * has zero Remotion dependencies, so the same components feed both the video
 * composition and the standalone playground.
 *
 * Every shape exposes a `params` interface so size, density, color, and
 * geometric quirks are tweakable from sliders.
 */

// -- ConcentricArcs ---------------------------------------------------------
export type ConcentricArcsParams = {
  color: string;
  ringCount: number;
  strokeWidth: number;
  /** Distance between rings, in viewBox units. */
  gap: number;
  /** Where the arcs originate from: which corner becomes the center. */
  origin?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
};

export const ConcentricArcs: React.FC<ConcentricArcsParams> = ({
  color,
  ringCount,
  strokeWidth,
  gap,
  origin = "top-left",
}) => {
  const transforms: Record<NonNullable<ConcentricArcsParams["origin"]>, string> =
    {
      "top-left": "",
      "top-right": "translate(100 0) scale(-1 1)",
      "bottom-left": "translate(0 100) scale(1 -1)",
      "bottom-right": "translate(100 100) scale(-1 -1)",
    };
  return (
    <g transform={transforms[origin]} stroke={color} fill="none">
      {Array.from({ length: ringCount }).map((_, i) => {
        const r = 6 + i * gap;
        return (
          <path
            key={i}
            d={`M 0 ${r} A ${r} ${r} 0 0 1 ${r} 0`}
            strokeWidth={strokeWidth}
          />
        );
      })}
    </g>
  );
};

// -- RadialBurst ------------------------------------------------------------
export type RadialBurstParams = {
  color: string;
  wedgeCount: number;
  /** Half-angle of each wedge at the rim, in viewBox units. */
  wedgeWidth: number;
  /** 0..1 — perturbation that randomly thickens some wedges. */
  clash: number;
  /** Length of the wedge from center, in viewBox units. */
  radius?: number;
};

export const RadialBurst: React.FC<RadialBurstParams> = ({
  color,
  wedgeCount,
  wedgeWidth,
  clash,
  radius = 50,
}) => {
  return (
    <g transform="translate(50 50)">
      {Array.from({ length: wedgeCount }).map((_, i) => {
        const angle = (i / wedgeCount) * 360;
        const skew = clash * (i % 3 === 0 ? 4 : 0);
        const w = wedgeWidth + skew * 0.15;
        return (
          <g key={i} transform={`rotate(${angle})`}>
            <polygon
              points={`0,0 ${w},${-radius} ${-w},${-radius}`}
              fill={color}
            />
          </g>
        );
      })}
    </g>
  );
};

// -- DomeArches -------------------------------------------------------------
export type DomeArchesParams = {
  color: string;
  sliceCount: number;
  strokeWidth: number;
  /** y position of the dome's base inside the 100×100 viewBox. */
  baseline?: number;
};

export const DomeArches: React.FC<DomeArchesParams> = ({
  color,
  sliceCount,
  strokeWidth,
  baseline = 80,
}) => {
  const step = 50 / sliceCount;
  return (
    <g>
      {Array.from({ length: sliceCount }).map((_, i) => {
        const r = 50 - i * step;
        if (r <= 0) return null;
        return (
          <path
            key={i}
            d={`M ${50 - r} ${baseline} A ${r} ${r} 0 0 1 ${50 + r} ${baseline}`}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
          />
        );
      })}
    </g>
  );
};

// -- CheckerWheel -----------------------------------------------------------
export type CheckerWheelParams = {
  primary: string;
  secondary: string;
  slices: number;
  rings: number;
  /** 0..1 — wobble that displaces ring radii so the wheel feels glitchy. */
  clash: number;
  /** Outer radius in viewBox units. */
  radius?: number;
};

export const CheckerWheel: React.FC<CheckerWheelParams> = ({
  primary,
  secondary,
  slices,
  rings,
  clash,
  radius = 46,
}) => {
  const cx = 50;
  const cy = 50;
  const cells: React.ReactNode[] = [];
  for (let s = 0; s < slices; s++) {
    const a0 = (s / slices) * Math.PI * 2;
    const a1 = ((s + 1) / slices) * Math.PI * 2;
    for (let r = 0; r < rings; r++) {
      const r0 = (r / rings) * radius;
      const r1 = ((r + 1) / rings) * radius;
      const fill =
        (s + r) % 2 === 0
          ? primary
          : r % 2 === 1
            ? secondary
            : "#FFFFFF";
      const wobble = clash * (Math.sin(s + r) * 0.6);
      const p0 = polar(cx, cy, r0 + wobble, a0);
      const p1 = polar(cx, cy, r1 + wobble, a0);
      const p2 = polar(cx, cy, r1 + wobble, a1);
      const p3 = polar(cx, cy, r0 + wobble, a1);
      const largeArc = a1 - a0 > Math.PI ? 1 : 0;
      cells.push(
        <path
          key={`${s}-${r}`}
          d={`M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} A ${r1} ${r1} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${r0} ${r0} 0 ${largeArc} 0 ${p0.x} ${p0.y} Z`}
          fill={fill}
        />,
      );
    }
  }
  return <g>{cells}</g>;
};

const polar = (cx: number, cy: number, r: number, a: number) => ({
  x: cx + Math.cos(a) * r,
  y: cy + Math.sin(a) * r,
});

// -- Style index ------------------------------------------------------------
export type ShapeStyle = 0 | 1 | 2 | 3;

export const STYLE_NAMES: Record<ShapeStyle, string> = {
  0: "Concentric Arcs",
  1: "Radial Burst",
  2: "Dome Arches",
  3: "Checker Wheel",
};
