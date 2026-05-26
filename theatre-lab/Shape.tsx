import React from "react";
import type { ISheetObject } from "@theatre/core";
import type { ShapeKind } from "./theatre";

type SlotValue = {
  kind: ShapeKind;
  x: number;
  y: number;
  size: number;
  rotation: number;
  fill: { r: number; g: number; b: number; a: number };
  stroke: { r: number; g: number; b: number; a: number };
  strokeWidth: number;
  opacity: number;
  sides: number;
  innerRatio: number;
  aspect: number;
  length: number;
};

type SlotObj = ISheetObject<SlotValue>;

const useTheatreValue = <T,>(obj: ISheetObject<T>): T => {
  const [v, setV] = React.useState(obj.value);
  React.useEffect(() => obj.onValuesChange((n) => setV(n)), [obj]);
  return v;
};

const rgba = (c: { r: number; g: number; b: number; a: number }) =>
  `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`;

export const Shape: React.FC<{ obj: SlotObj }> = ({ obj }) => {
  const v = useTheatreValue(obj);
  if (v.kind === "off") return null;

  const fill = rgba(v.fill);
  const stroke = rgba(v.stroke);
  const sw = v.strokeWidth;
  const transform = `translate(${v.x.toFixed(1)} ${v.y.toFixed(1)}) rotate(${((v.rotation * 180) / Math.PI).toFixed(2)})`;

  if (v.kind === "circle") {
    return (
      <g transform={transform} opacity={v.opacity}>
        <circle
          cx={0}
          cy={0}
          r={v.size / 2}
          fill={fill}
          stroke={sw > 0 ? stroke : "none"}
          strokeWidth={sw}
        />
      </g>
    );
  }

  if (v.kind === "ring") {
    return (
      <g transform={transform} opacity={v.opacity}>
        <circle
          cx={0}
          cy={0}
          r={v.size / 2}
          fill="none"
          stroke={fill}
          strokeWidth={Math.max(1, sw || 6)}
        />
      </g>
    );
  }

  if (v.kind === "rect") {
    const w = v.size * v.aspect;
    const h = v.size;
    return (
      <g transform={transform} opacity={v.opacity}>
        <rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          fill={fill}
          stroke={sw > 0 ? stroke : "none"}
          strokeWidth={sw}
        />
      </g>
    );
  }

  if (v.kind === "polygon") {
    const sides = Math.max(3, Math.floor(v.sides));
    const r = v.size / 2;
    const pts: string[] = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
    }
    return (
      <g transform={transform} opacity={v.opacity}>
        <polygon
          points={pts.join(" ")}
          fill={fill}
          stroke={sw > 0 ? stroke : "none"}
          strokeWidth={sw}
        />
      </g>
    );
  }

  if (v.kind === "star") {
    const points = Math.max(3, Math.floor(v.sides));
    const outer = v.size / 2;
    const inner = outer * v.innerRatio;
    const pts: string[] = [];
    for (let i = 0; i < points * 2; i++) {
      const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
    }
    return (
      <g transform={transform} opacity={v.opacity}>
        <polygon
          points={pts.join(" ")}
          fill={fill}
          stroke={sw > 0 ? stroke : "none"}
          strokeWidth={sw}
        />
      </g>
    );
  }

  if (v.kind === "line") {
    const half = v.length / 2;
    return (
      <g transform={transform} opacity={v.opacity}>
        <line
          x1={-half}
          y1={0}
          x2={half}
          y2={0}
          stroke={fill}
          strokeWidth={Math.max(1, sw || 6)}
          strokeLinecap="round"
        />
      </g>
    );
  }

  return null;
};
