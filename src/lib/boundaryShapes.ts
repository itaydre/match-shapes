// Boundary shapes — named SVG path generators that inscribe a shape
// inside a rectangular box. Used as clipPath silhouettes that mask the
// generated cellGrid pattern, so the same procedural pattern can read
// as a "blob", an "arch", a "circle", and so on.
//
// All paths are absolute SVG coordinates anchored to the supplied box
// (x, y, w, h). Each function returns the `d` attribute for a `<path>`.

export type LabBoundaryShape =
  | "circle"
  | "square"
  | "rectangle"
  | "oval"
  | "arch"
  | "capsule"
  | "organic_blob"
  | "irregular_polygon"
  // Regular n-gons inscribed in the box. Apex points UP for visual
  // consistency. Used to give each goal its own formal silhouette.
  | "triangle"
  | "pentagon"
  | "hexagon"
  | "heptagon"
  | "octagon";

export const ALL_BOUNDARY_SHAPES: LabBoundaryShape[] = [
  "circle",
  "square",
  "rectangle",
  "oval",
  "arch",
  "capsule",
  "organic_blob",
  "irregular_polygon",
  "triangle",
  "pentagon",
  "hexagon",
  "heptagon",
  "octagon",
];

// Number of sides per regular-polygon shape (apex-up by convention).
const REGULAR_POLYGON_SIDES: Partial<Record<LabBoundaryShape, number>> = {
  triangle: 3,
  pentagon: 5,
  hexagon: 6,
  heptagon: 7,
  octagon: 8,
};

export const boundaryPathForBox = (
  shape: LabBoundaryShape,
  x: number,
  y: number,
  w: number,
  h: number,
  seed = 17,
): string => {
  const L = x;
  const T = y;
  const R = x + w;
  const B = y + h;
  const cx = (L + R) / 2;
  const cy = (T + B) / 2;
  switch (shape) {
    case "rectangle":
      return `M${L},${T} H${R} V${B} H${L} Z`;
    case "square": {
      const side = Math.min(w, h);
      const sx = cx - side / 2;
      const sy = cy - side / 2;
      return `M${sx},${sy} h${side} v${side} h${-side} Z`;
    }
    case "circle": {
      const r = Math.min(w, h) / 2;
      return `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0 Z`;
    }
    case "oval": {
      const rx = w / 2;
      const ry = h / 2;
      return `M ${cx - rx},${cy} a ${rx},${ry} 0 1,0 ${rx * 2},0 a ${rx},${ry} 0 1,0 ${-rx * 2},0 Z`;
    }
    case "arch": {
      const rx = w / 2;
      const ry = h * 0.55;
      return `M ${L},${B} L ${L},${cy} A ${rx},${ry} 0 0 1 ${R},${cy} L ${R},${B} Z`;
    }
    case "capsule": {
      const r = Math.min(w, h) * 0.45;
      return `M ${L + r},${T} H ${R - r} A ${r},${r} 0 0 1 ${R},${T + r} V ${B - r} A ${r},${r} 0 0 1 ${R - r},${B} H ${L + r} A ${r},${r} 0 0 1 ${L},${B - r} V ${T + r} A ${r},${r} 0 0 1 ${L + r},${T} Z`;
    }
    case "organic_blob": {
      const N = 64;
      const baseR = Math.min(w, h) / 2 * 0.96;
      const pts: string[] = [];
      for (let k = 0; k <= N; k++) {
        const a = (k / N) * Math.PI * 2;
        const wob =
          Math.sin(a * 3 + seed * 0.7) * baseR * 0.12 +
          Math.sin(a * 7 + seed * 1.3) * baseR * 0.06 +
          Math.sin(a * 11 + seed * 1.9) * baseR * 0.04;
        const r = baseR + wob;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        pts.push(`${k === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`);
      }
      pts.push("Z");
      return pts.join(" ");
    }
    case "irregular_polygon": {
      const N = 8;
      const baseR = Math.min(w, h) / 2 * 0.96;
      const pts: string[] = [];
      for (let k = 0; k < N; k++) {
        const a = (k / N) * Math.PI * 2 - Math.PI / 2;
        const jitter = 0.65 + ((Math.sin(k * 53.13 + seed) + 1) / 2) * 0.45;
        const r = baseR * jitter;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        pts.push(`${k === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`);
      }
      pts.push("Z");
      return pts.join(" ");
    }
    case "triangle":
    case "pentagon":
    case "hexagon":
    case "heptagon":
    case "octagon": {
      const N = REGULAR_POLYGON_SIDES[shape]!;
      const r = Math.min(w, h) / 2 * 0.98;
      const pts: string[] = [];
      for (let k = 0; k < N; k++) {
        // Apex pointing UP — start at -π/2 so the first vertex sits
        // directly above the centre. Even-sided polygons (hex/oct)
        // will have a flat top edge instead; odd-sided (tri/pent/
        // hept) will read as a clear "point up" silhouette.
        const a = (k / N) * Math.PI * 2 - Math.PI / 2;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        pts.push(`${k === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`);
      }
      pts.push("Z");
      return pts.join(" ");
    }
  }
};
