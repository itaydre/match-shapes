// Procedural cell-grid generator. One module producing six shape
// "types", all rendered as a list of coloured rectangles (with
// optional rotation) so the host composition can paint them straight
// to SVG. Each type quantises the goal animation to a different
// underlying lattice — Cartesian, polar, etc.
//
// Settings model mirrors the reference UI:
//   Colors & Distribution: colorRandomness, dominantColor,
//     colorClustering, colorContrast
//   Distortion & Force:    distortionStrength, outwardForce,
//     curvature, asymmetry
//   Layout & Transform:    shapeDensity, shapeScale, rotation,
//     margin, seed
//
// All numeric settings are 0..100 (or otherwise documented) so they
// map 1:1 to slider values in a future UI.

export type CellGridType =
  | "blocks"
  | "wedges"
  | "arcs"
  | "checker_fields"
  | "warped_bands"
  | "radial_segments"
  // New "geometric logic" variants from the updated control mockup.
  | "radial_burst"
  | "kinetic_shockwave"
  | "fragmented_ray"
  | "mixed"
  // Aesthetic types from the broadcast/plotter/ink-spiral brief.
  | "plotter_lines"
  | "particle_burst"
  | "ink_spiral"
  // Organic-cell variant — soft blob outlines run through the warp
  // field, so they squish under pressure instead of staying round.
  | "squishy_blobs"
  // Polar checker grid (wedges × rings, alternating fill) with a
  // single "exploded" wedge fanned into many sub-wedges.
  | "radial_checker"
  // Concentric rings each with a different wedge count + one
  // "broken" ring of thin radial lines + an inner solid dot.
  // Reads as an optical calibration target collapsing inward.
  | "optical_dial"
  // Cartesian grid of chunky rect "pixels" colored by a quantized
  // multi-sine height field. Retro digital topography / heatmap.
  | "pixel_topography"
  // Layered composite — halftone dots + radial burst + warped
  // bands stacked into a single cell list. Generative poster mass.
  | "poster_stack"
  // Two radial_checker fields slightly rotated/re-seeded so their
  // warp fields drift past each other — produces a moiré-style
  // optical pulse reading as rotational symmetry + frequency beat.
  | "interference_mandala"
  // Modular grid of crescent slivers, mirror-flipped per row, with
  // per-column compression so the grid reads as a vibrating
  // interference field.
  | "crescent_grid"
  // Stack of horizontal bands whose top/bottom edges are warped by
  // sinusoidal displacement — parallel stripes flowing under
  // synchronized sine-wave deformation.
  | "sine_stripes"
  // Cartesian grid where each cell splits into two right triangles
  // (NW + SE), tessellating as a stained-glass field.
  | "triangle_grid"
  // Offset honeycomb of regular hexagons.
  | "hexagon_grid"
  // Cartesian grid of ellipses with seeded aspect-ratio variation.
  | "ellipse_field"
  // Each cell picks a different primitive — triangle, square,
  // pentagon, hexagon, octagon, ellipse, circle — for maximum
  // primitive diversity in a single shape.
  | "primitive_soup"
  // Polygon-only mix — triangles through octagons at varied sizes
  // on a jittered grid. Like primitive_soup but without curved
  // primitives, so the field reads as "many polygons together".
  | "polygon_mix"
  // Voronoi tessellation: each cell is the set of points closer to
  // its seed than to any other seed. Organic mosaic of irregular
  // polygons.
  | "voronoi_cells"
  // Delaunay triangulation: the dual of Voronoi — a mesh of
  // triangles connecting nearest-neighbour seeds.
  | "delaunay_mesh"
  // Wireframe mesh grid — horizontal + vertical edges between
  // warped control points, each edge rendered as a thin quad with
  // a position-dependent palette colour for a gradient-mesh outline.
  | "mesh_gradient"
  // Concentric thin contour lines with sine-harmonic wobble — a
  // topographic-map / elevation-curve aesthetic bounded by the
  // boundary clip (works best inside a circle).
  | "topographic_lines"
  // A "polygon" silhouette implicitly defined by a dense cluster of
  // smaller varied polygons packed inside an outer polygon outline.
  // Reads as one polygon shape composed of many smaller polygons.
  | "polygon_composite"
  // Folk / ceremonial spiral: partial-spiral sawtooth bands curving
  // around a centre with alternating colours, plus a ring of vesica
  // (almond / leaf) ornaments around the perimeter.
  | "zigzag_spiral"
  // Phyllotaxis flower: petals laid out on a golden-angle spiral
  // from a central seed, growing outward toward the rim.
  | "spiral_flower"
  // Horizontally-mirrored stepped waveform: rows extrude outward
  // from a centre axis, each offset rightward so the form points
  // left and ends flush right. Reads as an audio waveform / signal
  // burst / glitched extrusion.
  | "signal_burst"
  // Multi-treatment ring vortex: concentric rings shifted diagonally
  // toward a vanishing point, each rendered with a different graphic
  // treatment (dotted / striped / arcs / checker / outline / blocks).
  | "vortex_rings"
  // Teardrop silhouette built from many curved vertical ribbon
  // strips with gaps between them — reads as a chrome-ribbon shell
  // or parametric balloon.
  | "ribbon_teardrop"
  // Halftone dot grid where dot size is driven by a smooth density
  // field — creates blob-like organic volumes through dot-size
  // variation rather than solid fills.
  | "halftone_blob"
  // Chaotic ink-splatter impact: central irregular blob + tapered
  // radial streaks + scattered droplets + spray-noise dots.
  | "ink_splatter"
  // Dense pixel grid with CMYK-style channel offsets + a diagonal
  // sine flow field that drives per-cell intensity. Reads as a
  // dithered chromatic raster with print misregistration.
  | "chromatic_dither"
  // Repeated minimal junctions — each one a small set of thick
  // tapered arms meeting at a soft central dot, like a subway-map
  // node grid.
  | "vector_junctions"
  // Tilted pinwheel — radial spokes around a central elliptical
  // void, vertically squashed to read as a disc rotated on its
  // horizontal axis. Colours cycle per spoke.
  | "pinwheel_tilt"
  // Three concentric rings of radial tapered spokes around a tiny
  // central dot — reads as an op-art dial / instrument face.
  | "concentric_spokes";

export type CellGridSettings = {
  // 0..100. Probability each cell picks a fully random palette colour
  // instead of one weighted toward the dominant.
  colorRandomness: number;
  // 0..100. Bias toward palette[0] — the dominant colour.
  dominantColor: number;
  // 0..100. Neighbours share colour more strongly as this rises.
  colorClustering: number;
  // 0..100. Pulls neighbouring cells toward opposite ends of the
  // palette so adjacent cells contrast harder.
  colorContrast: number;
  // 0..100. How much the lattice warps (translation jitter).
  distortionStrength: number;
  // -100..100. Outward push from the centre. Negative values pull
  // points INWARD (acting as a global pinch toward the centre).
  outwardForce: number;
  // 0..100. Inverse radial weighting — at high values the cells closest
  // to the centre get pulled in extra hard, producing a pinched core.
  // Independent from outwardForce so a pattern can both expand and
  // pinch its core simultaneously.
  pinchIntensity?: number;
  // 0..100. Per-cell rotation/skew jitter applied as part of each
  // cell's transform — gives rectangular cells slightly organic edges.
  edgeOrganicness?: number;
  // 0..180 (degrees). Twist around the centre — cells further from
  // the centre rotate more.
  curvature: number;
  // 0..100. Skew bias in a single direction.
  asymmetry: number;
  // 5..50. Column count for Cartesian types; ring count for polar.
  shapeDensity: number;
  // 0..1.5. Cell-size multiplier.
  shapeScale: number;
  // 0..360 (degrees). Rotation of the entire pattern.
  rotation: number;
  // 0..200 px. Margin inside the bounding box.
  margin: number;
  // Seed for deterministic randomness.
  seed: number;
};

export const DEFAULT_SETTINGS: CellGridSettings = {
  colorRandomness: 34,
  dominantColor: 30,
  colorClustering: 30,
  colorContrast: 56,
  distortionStrength: 55,
  outwardForce: 20,
  pinchIntensity: 0,
  edgeOrganicness: 0,
  curvature: 0,
  asymmetry: 20,
  shapeDensity: 27,
  shapeScale: 0.5,
  rotation: 151,
  margin: 100,
  seed: 123,
};

export type GridCell = {
  // Warped-quad SVG path (new — produced by the warpQuadPath helper).
  // When set, the composition renders this cell as a <path d={d}>
  // instead of a <rect>. Cells generated through quadCell() are always
  // path-based; legacy rect cells set the rect fields below and leave
  // `d` undefined.
  d?: string;
  // Legacy rect fields. Still used by builders that haven't been
  // ported to the warped-quad pipeline.
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  transform?: string;
  color: string;
  // Cell centre (in the build's local zone coords). Optional — set
  // by quadCell so renderers can scale/animate around the cell's
  // visual anchor (used by the staggered per-cell reveal).
  cx?: number;
  cy?: number;
  // Optional 0..1 normalized reveal order. When set, the per-cell
  // stagger uses this directly instead of the default
  // distance-from-focal ratio. Lets each builder craft its own
  // reveal rhythm (left-to-right, top-to-bottom, density-first,
  // spiral-out, etc.) while keeping cx/cy as the scale/translate
  // origin so the eruption-from-centre still applies.
  revealOrder?: number;
};

// ── Warped-coordinate field ─────────────────────────────────────────
// Ported from versus-version-02.html getWarpedPoint(). Given a point
// (px, py) inside a sub-zone of dimensions (w, h), produce its warped
// position. The warp combines:
//   * global rotation around the zone centre
//   * radial pinch (compresses toward the centre as nd→0)
//   * outward bulge with exponential falloff
//   * spiral twist with exponential falloff
// All settings live on the same CellGridSettings object as before, so
// the lab sliders feed straight into this function.
const warpPoint = (
  px: number,
  py: number,
  w: number,
  h: number,
  s: CellGridSettings,
): { x: number; y: number } => {
  const cxZone = w / 2;
  const cyZone = h / 2;

  // Step 1 — global rotation around the zone centre.
  let qx = px - cxZone;
  let qy = py - cyZone;
  const ra = Math.atan2(qy, qx) + ((s.rotation || 0) * Math.PI) / 180;
  const rd = Math.sqrt(qx * qx + qy * qy);
  qx = cxZone + Math.cos(ra) * rd;
  qy = cyZone + Math.sin(ra) * rd;

  // Step 2 — distance + angle from a (possibly asymmetric) distortion
  // centre. Asymmetry nudges the centre by a deterministic amount so
  // the warp doesn't always emanate from exactly (cx, cy).
  const seedJitterX = (hash(s.seed) - 0.5) * (s.asymmetry || 0) * 2;
  const seedJitterY = (hash(s.seed + 1) - 0.5) * (s.asymmetry || 0) * 2;
  const dcx = cxZone + seedJitterX;
  const dcy = cyZone + seedJitterY;
  const dx = qx - dcx;
  const dy = qy - dcy;
  let d = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  const maxDim = Math.max(w, h) * 0.5;
  const nd = d / Math.max(0.001, maxDim);
  const strength = (s.distortionStrength || 0) * 0.01;

  // Pinch — compress radially toward the centre as nd→0.
  const pinchIntensity = (s.pinchIntensity ?? 0) * 0.01;
  if (pinchIntensity > 0) {
    d = d * Math.pow(Math.max(nd, 0.001), pinchIntensity * 2);
  }

  // Outward bulge — exponential falloff so the effect peaks near the
  // centre and decays toward the rim.
  const bulgeFactor = (s.outwardForce || 0) * 0.01 * Math.exp(-nd * 1.5);
  const r = d * (1 + bulgeFactor * strength);

  // Twist — angular shear that decays with distance from the centre.
  const twistFactor = (s.curvature || 0) * 0.05 * Math.exp(-nd * 1.2);
  const a = angle + twistFactor * strength;

  return {
    x: dcx + Math.cos(a) * r,
    y: dcy + Math.sin(a) * r,
  };
};

// Build an SVG path that subdivides each edge of a quad and runs every
// sample point through `warpPoint`, producing a cell with genuinely
// curved edges (not just a transformed rectangle). Port of the HTML's
// drawWarpedQuad — same 4-edge × `subdivisions`-sample loop.
const warpQuadPath = (
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
  w: number,
  h: number,
  s: CellGridSettings,
  subdivisions = 4,
): string => {
  const out: string[] = [];
  const moveOrLine = (i: number, p: { x: number; y: number }) => {
    out.push(`${i === 0 && out.length === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
  };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  // Edge p1→p2
  for (let i = 0; i <= subdivisions; i++) {
    const t = i / subdivisions;
    const p = warpPoint(lerp(p1.x, p2.x, t), lerp(p1.y, p2.y, t), w, h, s);
    moveOrLine(i, p);
  }
  // Edge p2→p3 (skip i=0 to avoid duplicate corner point)
  for (let i = 1; i <= subdivisions; i++) {
    const t = i / subdivisions;
    const p = warpPoint(lerp(p2.x, p3.x, t), lerp(p2.y, p3.y, t), w, h, s);
    moveOrLine(i, p);
  }
  // Edge p3→p4
  for (let i = 1; i <= subdivisions; i++) {
    const t = i / subdivisions;
    const p = warpPoint(lerp(p3.x, p4.x, t), lerp(p3.y, p4.y, t), w, h, s);
    moveOrLine(i, p);
  }
  // Edge p4→p1
  for (let i = 1; i <= subdivisions; i++) {
    const t = i / subdivisions;
    const p = warpPoint(lerp(p4.x, p1.x, t), lerp(p4.y, p1.y, t), w, h, s);
    moveOrLine(i, p);
  }
  out.push("Z");
  return out.join(" ");
};

// Convenience: build one quad cell from 4 corner points + a colour.
// Skipped if the cell would be invisible because its centre falls
// outside the silhouette bounds (presence probability rolled against
// the seed — matches the HTML's renderModule / renderWedge gate).
const quadCell = (
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number },
  w: number,
  h: number,
  s: CellGridSettings,
  color: string,
): GridCell => ({
  d: warpQuadPath(p1, p2, p3, p4, w, h, s, 4),
  color,
  // Pre-warp centroid of the quad. Used by the renderer as the cell's
  // anchor for per-cell stagger animation (scale from focal, distance-
  // based ordering).
  cx: (p1.x + p2.x + p3.x + p4.x) / 4,
  cy: (p1.y + p2.y + p3.y + p4.y) / 4,
});

// Deterministic hash. Cheap, reproducible across runs.
const hash = (n: number): number => {
  const s = Math.sin(n) * 43758.5453;
  return s - Math.floor(s);
};

// Pick a colour for a cell at (col, row) given the distribution settings.
const pickColor = (
  palette: string[],
  col: number,
  row: number,
  s: CellGridSettings,
): string => {
  if (palette.length === 0) return "#000";
  const r0 = hash(s.seed + col * 12.34 + row * 56.78);
  const r1 = hash(s.seed + col * 91.27 + row * 41.13);
  const r2 = hash(s.seed + (col + row) * 3.7);

  // Cluster bias: tilt toward neighbour colour using col+row band.
  const band = Math.floor((col + row) * (s.colorClustering / 50));

  let idx: number;
  if (r0 < s.colorRandomness / 100) {
    idx = Math.floor(r1 * palette.length);
  } else {
    // Dominant colour wins more often when dominantColor is high.
    if (r2 < s.dominantColor / 100) {
      idx = 0; // dominant
    } else {
      idx = (band + Math.floor(r1 * (palette.length - 1)) + 1) % palette.length;
    }
  }

  // Contrast: nudge to a colour further across the palette when set.
  if (s.colorContrast > 50 && (col + row) % 2 === 0) {
    idx = (idx + Math.floor(palette.length / 2)) % palette.length;
  }
  return palette[idx]!;
};

// Apply distortion to a cell anchor point. Distortion is noise-based,
// outward force pushes away from centre, curvature rotates around
// centre, asymmetry adds a directional bias.
const distortPoint = (
  px: number,
  py: number,
  cx: number,
  cy: number,
  s: CellGridSettings,
): { x: number; y: number } => {
  const dx = px - cx;
  const dy = py - cy;
  const dist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  // Noise jitter
  const nx = (hash(s.seed + px * 0.01 + py * 0.02) - 0.5) * (s.distortionStrength / 100) * 60;
  const ny = (hash(s.seed + px * 0.03 + py * 0.04) - 0.5) * (s.distortionStrength / 100) * 60;

  // Outward push (negative values pull inward, supporting "Radial
  // Expansion" sliders that allow negative values).
  const out = (s.outwardForce / 100) * 40;
  const ox = Math.cos(angle) * out;
  const oy = Math.sin(angle) * out;

  // Pinch — inverse-radial pull toward centre that's strongest near
  // the centre and weakest at the rim. Independent of outwardForce so
  // patterns can both expand AND pinch their core.
  const pinch = s.pinchIntensity ?? 0;
  let pinchX = 0;
  let pinchY = 0;
  if (pinch > 0 && dist > 0.001) {
    const falloff = 1 / (1 + dist / 200);
    const k = (pinch / 100) * 60 * falloff;
    pinchX = -Math.cos(angle) * k;
    pinchY = -Math.sin(angle) * k;
  }

  // Curvature (twist) — rotation proportional to distance.
  const twistRad = ((s.curvature / 100) * Math.PI) * (dist / 400);
  const cos = Math.cos(twistRad);
  const sin = Math.sin(twistRad);
  const tx = dx * cos - dy * sin;
  const ty = dx * sin + dy * cos;

  // Asymmetry — directional bias
  const asym = (s.asymmetry / 100) * 30;
  const ax = asym;
  const ay = 0;

  return {
    x: cx + tx + nx + ox + ax + pinchX,
    y: cy + ty + ny + oy + ay + pinchY,
  };
};

// Per-cell organic edge jitter — appended to each cell's transform so
// rectangles read with slightly broken edges. Deterministic per seed +
// (col, row).
const edgeJitter = (
  s: CellGridSettings,
  col: number,
  row: number,
  cellW: number,
  cellH: number,
): string => {
  const eo = s.edgeOrganicness ?? 0;
  if (eo <= 0) return "";
  const h1 = hash(s.seed + col * 0.71 + row * 1.31);
  const h2 = hash(s.seed + col * 1.93 + row * 0.47);
  const h3 = hash(s.seed + (col + row) * 2.11);
  const rotDeg = (h1 - 0.5) * (eo / 100) * 18;
  const skewDeg = (h2 - 0.5) * (eo / 100) * 12;
  const scale = 1 + (h3 - 0.5) * (eo / 100) * 0.22;
  const ccx = cellW / 2;
  const ccy = cellH / 2;
  return `rotate(${rotDeg.toFixed(2)} ${ccx.toFixed(1)} ${ccy.toFixed(1)}) skewX(${skewDeg.toFixed(2)}) scale(${scale.toFixed(3)})`;
};

// Wrap a list of cells with the global rotation transform.
const withRotation = (cells: GridCell[], rotationDeg: number, cx: number, cy: number): GridCell[] => {
  if (rotationDeg === 0) return cells;
  const t = `rotate(${rotationDeg.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})`;
  return cells.map((c) => ({ ...c, transform: `${t} ${c.transform}`.trim() }));
};

// ── Type-specific generators ────────────────────────────────────────────

// Presence test — for each cell we roll a random number against the
// boundary distance / silhouette softness. Cells outside the silhouette
// (bDist <= 0) are skipped entirely, and cells near the rim drop out
// probabilistically so the silhouette has a soft feathered edge instead
// of a hard cut. Matches renderModule / renderWedge in the HTML source.
const cellPresent = (
  centerX: number,
  centerY: number,
  w: number,
  h: number,
  s: CellGridSettings,
  ix: number,
  iy: number,
): boolean => {
  // Hard panel-margin gate first — keeps everything inside the visible
  // sub-zone. The composition also clips via clipPath but this is a
  // cheaper early-out.
  if (centerX < 0 || centerY < 0 || centerX > w || centerY > h) return false;
  // Soft falloff toward the rim using a normalized distance. The HTML
  // uses a per-shape boundary; here we approximate with a rectangular
  // box so a single softness knob still feathers the edges naturally.
  // Use a RADIAL distance instead of a box distance so the falloff
  // wraps around the centre — combined with high softness this
  // produces an edge that feathers smoothly into the background
  // instead of a hard rectangular cut.
  const dxR = (centerX - w / 2) / Math.max(0.001, w / 2);
  const dyR = (centerY - h / 2) / Math.max(0.001, h / 2);
  const radial = Math.min(1, Math.hypot(dxR, dyR));
  const bDist = Math.max(0, 1 - radial);
  // Higher softness = gentler taper. With softness ~1.2 cells fade
  // linearly from full at the centre to ~0 at the rim.
  const softness = 1.2;
  const presenceProb = Math.min(1, bDist / (softness + 0.001));
  return hash(s.seed + ix * 100 + iy) <= presenceProb;
};

// BLOCKS — Cartesian grid of warped quads. Each cell is rendered as an
// SVG path whose 4 edges have been subdivided into curves through the
// warp field, so the lattice reads as a continuously distorted sheet
// rather than translated rectangles.
const buildBlocks = (w: number, h: number, palette: string[], s: CellGridSettings): GridCell[] => {
  const density = Math.max(4, Math.floor(s.shapeDensity));
  const stepX = w / density;
  const stepY = h / density;
  const scale = s.shapeScale;
  const cells: GridCell[] = [];
  for (let ix = 0; ix < density; ix++) {
    for (let iy = 0; iy < density; iy++) {
      const x1 = ix * stepX;
      const y1 = iy * stepY;
      const x2 = (ix + 1) * stepX;
      const y2 = (iy + 1) * stepY;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      if (!cellPresent(cx, cy, w, h, s, ix, iy)) continue;
      const dx = (x2 - x1) * scale;
      const dy = (y2 - y1) * scale;
      cells.push(
        quadCell(
          { x: cx - dx / 2, y: cy - dy / 2 },
          { x: cx + dx / 2, y: cy - dy / 2 },
          { x: cx + dx / 2, y: cy + dy / 2 },
          { x: cx - dx / 2, y: cy + dy / 2 },
          w,
          h,
          s,
          pickColor(palette, ix, iy, s),
        ),
      );
    }
  }
  return cells;
};

// CHECKER_FIELDS — same lattice as blocks but only half the cells are
// drawn, in an alternating pattern.
const buildCheckerFields = (w: number, h: number, palette: string[], s: CellGridSettings): GridCell[] => {
  const density = Math.max(4, Math.floor(s.shapeDensity));
  const stepX = w / density;
  const stepY = h / density;
  const scale = s.shapeScale;
  const cells: GridCell[] = [];
  for (let ix = 0; ix < density; ix++) {
    for (let iy = 0; iy < density; iy++) {
      if ((ix + iy) % 2 === 0) continue;
      const x1 = ix * stepX;
      const y1 = iy * stepY;
      const x2 = (ix + 1) * stepX;
      const y2 = (iy + 1) * stepY;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      if (!cellPresent(cx, cy, w, h, s, ix, iy)) continue;
      const dx = (x2 - x1) * scale;
      const dy = (y2 - y1) * scale;
      cells.push(
        quadCell(
          { x: cx - dx / 2, y: cy - dy / 2 },
          { x: cx + dx / 2, y: cy - dy / 2 },
          { x: cx + dx / 2, y: cy + dy / 2 },
          { x: cx - dx / 2, y: cy + dy / 2 },
          w,
          h,
          s,
          pickColor(palette, ix, iy, s),
        ),
      );
    }
  }
  return cells;
};

// WARPED_BANDS — every other row drawn, each row split into segments
// across the full width. With the warp field active this produces the
// characteristic horizontal flowing bands.
const buildWarpedBands = (w: number, h: number, palette: string[], s: CellGridSettings): GridCell[] => {
  const density = Math.max(4, Math.floor(s.shapeDensity));
  const stepY = h / density;
  const segments = 20;
  const stepX = w / segments;
  const cells: GridCell[] = [];
  for (let iy = 0; iy < density; iy++) {
    if (iy % 2 === 0) continue;
    for (let ix = 0; ix < segments; ix++) {
      const x1 = ix * stepX;
      const y1 = iy * stepY;
      const x2 = (ix + 1) * stepX;
      const y2 = (iy + 1) * stepY;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      if (!cellPresent(cx, cy, w, h, s, ix, iy)) continue;
      cells.push(
        quadCell(
          { x: x1, y: y1 },
          { x: x2, y: y1 },
          { x: x2, y: y2 },
          { x: x1, y: y2 },
          w,
          h,
          s,
          pickColor(palette, ix, iy, s),
        ),
      );
    }
  }
  return cells;
};

// Polar quad builder — generates a (rings × sectors) wedge lattice
// over the sub-zone, with each cell built as a warped quad path.
// The caller supplies the maxR multiplier and per-cell skip rule so
// arcs/radial_burst etc. can reuse this without duplicating geometry.
const buildPolar = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
  opts: {
    rings: number;
    sectors: number;
    maxR: number;
    // Optional radius mapping per ring index (so e.g. arcs can draw a
    // half-thickness band, fragmented_ray can offset alternating).
    radiusFor?: (r: number) => { r1: number; r2: number };
    skip?: (r: number, s: number) => boolean;
  },
): GridCell[] => {
  const cells: GridCell[] = [];
  const cxZone = w / 2;
  const cyZone = h / 2;
  const { rings, sectors, maxR, radiusFor, skip } = opts;
  for (let r = 0; r < rings; r++) {
    const ringRadii = radiusFor
      ? radiusFor(r)
      : { r1: (r / rings) * maxR, r2: ((r + 1) / rings) * maxR };
    const { r1, r2 } = ringRadii;
    for (let si = 0; si < sectors; si++) {
      if (skip?.(r, si)) continue;
      const a1 = (si / sectors) * Math.PI * 2;
      const a2 = ((si + 1) / sectors) * Math.PI * 2;
      const p1 = { x: cxZone + Math.cos(a1) * r1, y: cyZone + Math.sin(a1) * r1 };
      const p2 = { x: cxZone + Math.cos(a2) * r1, y: cyZone + Math.sin(a2) * r1 };
      const p3 = { x: cxZone + Math.cos(a2) * r2, y: cyZone + Math.sin(a2) * r2 };
      const p4 = { x: cxZone + Math.cos(a1) * r2, y: cyZone + Math.sin(a1) * r2 };
      const cx = (p1.x + p2.x + p3.x + p4.x) / 4;
      const cy = (p1.y + p2.y + p3.y + p4.y) / 4;
      if (!cellPresent(cx, cy, w, h, s, r, si)) continue;
      cells.push(quadCell(p1, p2, p3, p4, w, h, s, pickColor(palette, si, r, s)));
    }
  }
  return cells;
};

// WEDGES — pie sectors as warped quads. Matches HTML's wedges case.
const buildWedges = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const density = Math.max(4, Math.floor(s.shapeDensity));
  return buildPolar(w, h, palette, s, {
    rings: Math.floor(density / 2),
    sectors: density,
    maxR: Math.max(w, h) * 0.8,
  });
};

// RADIAL_SEGMENTS — wedges with every-other cell skipped (checker
// pattern on a polar grid). Matches the HTML's `(r + s) % 2 === 0`
// skip rule for radial_segments.
const buildRadialSegments = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const density = Math.max(4, Math.floor(s.shapeDensity));
  return buildPolar(w, h, palette, s, {
    rings: Math.floor(density / 2),
    sectors: density,
    maxR: Math.max(w, h) * 0.8,
    skip: (r, si) => (r + si) % 2 === 0,
  });
};

// ARCS — concentric ring segments. Matches HTML's arcs case (every
// other ring drawn, 32 sectors per ring, half-thickness so they read
// as ribbons rather than full rings).
const buildArcs = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const density = Math.max(4, Math.floor(s.shapeDensity));
  const rings = density;
  const sectors = 32;
  const maxR = Math.max(w, h) * 0.8;
  return buildPolar(w, h, palette, s, {
    rings,
    sectors,
    maxR,
    radiusFor: (r) => ({
      r1: (r / rings) * maxR,
      r2: ((r + 0.6) / rings) * maxR,
    }),
    skip: (r) => r % 2 === 0,
  });
};

// RADIAL_BURST — many thin sectors × many rings. Matches HTML's
// radial_burst case (density*2 sectors, 20 rings, skip even sectors).
const buildRadialBurst = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const density = Math.max(4, Math.floor(s.shapeDensity));
  return buildPolar(w, h, palette, s, {
    rings: 20,
    sectors: density * 2,
    maxR: Math.max(w, h) * 1.5,
    skip: (_r, si) => si % 2 === 0,
  });
};

// KINETIC_SHOCKWAVE — rings × variable-sector polar grid with checker
// skip. Matches HTML's kinetic_shockwave case.
const buildKineticShockwave = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const density = Math.max(4, Math.floor(s.shapeDensity));
  const rings = Math.floor(density / 2);
  const maxR = Math.max(w, h) * 1.2;
  // HTML uses variable sector counts per ring (8 + r*4). Approximate
  // by using the max sector count and skipping cells outside the
  // per-ring count via the skip callback.
  const sectorsForRing = (r: number) => 8 + r * 4;
  const maxSectors = sectorsForRing(rings);
  return buildPolar(w, h, palette, s, {
    rings,
    sectors: maxSectors,
    maxR,
    skip: (r, si) => {
      // Reject sectors outside this ring's actual sector count.
      const ringSectors = sectorsForRing(r);
      if (si >= ringSectors) return true;
      return (r + si) % 2 === 0;
    },
  });
};

// FRAGMENTED_RAY — rings × variable sectors with random dropout +
// alternating radial offset. Matches HTML's fragmented_ray case.
// FRAGMENTED_RAY — Pen-tool style Bezier curves emanating from the
// centre. Each curve is a cubic Bezier with two control points
// offset perpendicular to its main direction, sampled into a thick
// stroked closed polygon. Reads as vector-illustration pen-tool
// paths radiating outward like calligraphic flourishes.
const buildFragmentedRay = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const cx = w / 2;
  const cy = h / 2;
  const maxR = (Math.min(w, h) / 2) * 0.96 * s.shapeScale;
  const pathCount = Math.max(8, Math.floor(s.shapeDensity * 0.6));
  const samples = 16;
  const lineW = Math.max(1.5, 3 * s.shapeScale);
  const cells: GridCell[] = [];

  const cubicAt = (
    t: number,
    p0: V2,
    c1: V2,
    c2: V2,
    p1: V2,
  ): V2 => {
    const omt = 1 - t;
    return {
      x:
        omt ** 3 * p0.x +
        3 * omt ** 2 * t * c1.x +
        3 * omt * t ** 2 * c2.x +
        t ** 3 * p1.x,
      y:
        omt ** 3 * p0.y +
        3 * omt ** 2 * t * c1.y +
        3 * omt * t ** 2 * c2.y +
        t ** 3 * p1.y,
    };
  };

  for (let i = 0; i < pathCount; i++) {
    if (hash(s.seed + i * 2.3) < 0.18) continue; // ~18% dropout
    const angleStart =
      (i / pathCount) * Math.PI * 2 + hash(s.seed + i * 3.1) * 0.4;
    const angleEnd = angleStart + (hash(s.seed + i * 7.3) - 0.5) * 0.9;
    const innerR = maxR * (0.04 + hash(s.seed + i * 5.1) * 0.12);
    const endR = maxR * (0.7 + hash(s.seed + i * 11.7) * 0.3);
    const p0: V2 = {
      x: cx + Math.cos(angleStart) * innerR,
      y: cy + Math.sin(angleStart) * innerR,
    };
    const p1: V2 = {
      x: cx + Math.cos(angleEnd) * endR,
      y: cy + Math.sin(angleEnd) * endR,
    };
    // Control points — push perpendicular to the rough line so the
    // curve bows. Magnitude varies per path.
    const offMag = maxR * 0.35;
    const c1: V2 = {
      x: cx + Math.cos(angleStart) * endR * 0.45 +
        (hash(s.seed + i * 13.1) - 0.5) * offMag,
      y: cy + Math.sin(angleStart) * endR * 0.45 +
        (hash(s.seed + i * 17.1) - 0.5) * offMag,
    };
    const c2: V2 = {
      x: cx + Math.cos(angleEnd) * endR * 0.7 +
        (hash(s.seed + i * 19.1) - 0.5) * offMag,
      y: cy + Math.sin(angleEnd) * endR * 0.7 +
        (hash(s.seed + i * 23.1) - 0.5) * offMag,
    };

    // Sample the Bezier into upper/lower offset polylines and close.
    const upper: V2[] = [];
    const lower: V2[] = [];
    let prev = cubicAt(0, p0, c1, c2, p1);
    for (let k = 1; k <= samples; k++) {
      const t = k / samples;
      const curr = cubicAt(t, p0, c1, c2, p1);
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const len = Math.hypot(dx, dy);
      if (len > 0.05) {
        const nx = (-dy / len) * (lineW / 2);
        const ny = (dx / len) * (lineW / 2);
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        upper.push({ x: mx + nx, y: my + ny });
        lower.push({ x: mx - nx, y: my - ny });
      }
      prev = curr;
    }
    if (upper.length < 2) continue;

    const parts: string[] = [];
    upper.forEach((p, k) => {
      const wp = warpPoint(p.x, p.y, w, h, s);
      parts.push(`${k === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
    });
    for (let k = lower.length - 1; k >= 0; k--) {
      const p = lower[k]!;
      const wp = warpPoint(p.x, p.y, w, h, s);
      parts.push(`L ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
    }
    parts.push("Z");
    const mid = cubicAt(0.5, p0, c1, c2, p1);
    cells.push({
      d: parts.join(" "),
      color: pickColor(palette, i, 0, s),
      cx: mid.x,
      cy: mid.y,
    });
  }
  return cells;
};

// MIXED — interleaves two underlying types so half the cells come from
// one pattern and half from another, picked deterministically from the
// seed. Useful as a fallback / variety knob.
const buildMixed = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const pickA = Math.floor(hash(s.seed + 1.7) * 6);
  const pickB = Math.floor(hash(s.seed + 8.3) * 6);
  const TYPES: CellGridType[] = [
    "blocks",
    "wedges",
    "arcs",
    "checker_fields",
    "warped_bands",
    "radial_segments",
  ];
  const aType = TYPES[pickA % TYPES.length]!;
  const bType = TYPES[(pickB + 1) % TYPES.length]!;
  const a = buildCellGrid(aType, s, w, h, palette);
  const b = buildCellGrid(bType, { ...s, seed: s.seed + 911 }, w, h, palette);
  // Interleave: take alternate cells from each list.
  const out: GridCell[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (i < a.length && i % 2 === 0) out.push(a[i]!);
    if (i < b.length && i % 2 === 1) out.push(b[i]!);
  }
  return out;
};

// ── Layered field — moiré, blend, recursive echoes ───────────────────────
// Each "layer" is a list of GridCells plus presentational attributes
// (opacity, optional outer transform). The composition/StaticPreview
// stack layers in render order so the field reads as multiple
// overlaid lattices — exactly what produces moiré in op-art.
export type FieldLayer = {
  cells: GridCell[];
  opacity: number;
  // Optional extra group transform applied around the cells (used by
  // recursive echoes to nest a scaled copy at the field's centre).
  transform?: string;
};

export type FieldLayerOptions = {
  // 0..100. Strength of a second copy of the primary pattern offset
  // by a small seed + rotation, layered on top to create moiré
  // interference. 0 = no ghost layer.
  moireStrength?: number;
  // Optional secondary geometric logic. When set together with a
  // non-zero blendAmount the field crossfades from primary → blend
  // target: blendAmount=0 hides the target, =100 hides the primary.
  blendTarget?: CellGridType;
  blendAmount?: number;
  // 0..3. Number of nested half-scale copies of the primary pattern
  // drawn at the field's centre, each at decreasing opacity. Produces
  // a recursive zoom feel.
  recursionDepth?: number;
};

export const buildFieldLayers = (
  primary: CellGridType,
  settings: CellGridSettings,
  w: number,
  h: number,
  palette: string[],
  opts: FieldLayerOptions = {},
): FieldLayer[] => {
  const moire = (opts.moireStrength ?? 0) / 100;
  const blend = (opts.blendAmount ?? 0) / 100;
  const depth = Math.max(0, Math.min(3, Math.floor(opts.recursionDepth ?? 0)));
  const layers: FieldLayer[] = [];

  // Primary layer — opacity tapers as the blend slider opens.
  const primaryOpacity = 1 - blend * 0.7;
  layers.push({
    cells: buildCellGrid(primary, settings, w, h, palette),
    opacity: primaryOpacity,
  });

  // Blend layer — secondary geometric logic crossfaded on top.
  if (opts.blendTarget && blend > 0) {
    layers.push({
      cells: buildCellGrid(opts.blendTarget, settings, w, h, palette),
      opacity: blend,
    });
  }

  // Moiré ghost — same primary lattice with a tiny seed + rotation
  // offset, overlaid at reduced opacity. Two grids beating against
  // each other = interference pattern.
  if (moire > 0) {
    const ghostSettings: CellGridSettings = {
      ...settings,
      seed: settings.seed + 19,
      rotation: settings.rotation + 7,
    };
    layers.push({
      cells: buildCellGrid(primary, ghostSettings, w, h, palette),
      opacity: moire * 0.75,
    });
  }

  // Recursive echoes — each nested copy drawn at 0.5^d scale around
  // the field's centre. Opacity decays with depth so the inner copy
  // doesn't drown out the outer one.
  for (let d = 1; d <= depth; d++) {
    const scale = Math.pow(0.5, d);
    const innerW = w * scale;
    const innerH = h * scale;
    const offsetX = (w - innerW) / 2;
    const offsetY = (h - innerH) / 2;
    // Slight angular offset per depth so the echoes don't perfectly
    // line up — produces the spiralled "looking down a tunnel" feel.
    const angleOffset = d * 11;
    const echoSettings: CellGridSettings = {
      ...settings,
      rotation: settings.rotation + angleOffset,
      seed: settings.seed + d * 47,
    };
    layers.push({
      cells: buildCellGrid(primary, echoSettings, innerW, innerH, palette),
      opacity: 0.55 / d,
      transform: `translate(${offsetX.toFixed(2)} ${offsetY.toFixed(2)})`,
    });
  }

  return layers;
};

// PLOTTER_LINES — pen-plotter aesthetic: rows of thin horizontal
// strokes with randomised lengths + horizontal offsets, ~25%
// deterministic dropout. The warp field still bends them so they
// pick up the same kinetic personality as the rest of the system.
// PLOTTER_LINES — Radial arm strokes emanating from the centre.
// Each line is a thin quad along a radial direction with varied
// length and start radius, so the field reads as a starburst of
// plotter strokes reaching outward from a central origin.
const buildPlotterLines = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const cx = w / 2;
  const cy = h / 2;
  const maxR = (Math.min(w, h) / 2) * 0.96 * s.shapeScale;
  const lineCount = Math.max(20, Math.floor(s.shapeDensity * 2.0));
  const lineH = Math.max(1.5, s.shapeScale * 3.5);
  const cells: GridCell[] = [];

  for (let i = 0; i < lineCount; i++) {
    // ~20% dropout for plotter "skip" feel.
    if (hash(s.seed + i * 1.7) < 0.2) continue;
    // Distribute angles around full circle + small jitter so the
    // arms don't form a perfectly regular fan.
    const angle =
      (i / lineCount) * Math.PI * 2 + hash(s.seed + i * 3.1) * 0.35;
    // Inner radius — arms start near the centre but not at exactly 0
    // so the centre stays visually distinct.
    const innerR = maxR * (0.04 + hash(s.seed + i * 5.3) * 0.18);
    // Length varies — some arms reach to rim, others stop short.
    const lenFrac = 0.35 + hash(s.seed + i * 7.7) * 0.65;
    const outerR = innerR + (maxR - innerR) * lenFrac;

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const perpX = -sinA * lineH / 2;
    const perpY = cosA * lineH / 2;
    cells.push(
      quadCell(
        { x: cx + cosA * innerR + perpX, y: cy + sinA * innerR + perpY },
        { x: cx + cosA * outerR + perpX, y: cy + sinA * outerR + perpY },
        { x: cx + cosA * outerR - perpX, y: cy + sinA * outerR - perpY },
        { x: cx + cosA * innerR - perpX, y: cy + sinA * innerR - perpY },
        w,
        h,
        s,
        pickColor(palette, 0, i, s),
      ),
    );
  }
  return cells;
};

// PARTICLE_BURST — many small quads scattered at random polar
// positions around the centre, biased outward (sqrt(rand) gives
// uniform area distribution so the rim is well-populated). Each
// particle is sized randomly within the scale range.
const buildParticleBurst = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const count = Math.max(40, Math.floor(s.shapeDensity * 4));
  const cx = w / 2;
  const cy = h / 2;
  const maxR = (Math.min(w, h) / 2) * 0.95;
  const cells: GridCell[] = [];
  for (let i = 0; i < count; i++) {
    const a = hash(s.seed + i * 3.7) * Math.PI * 2;
    const rT = Math.sqrt(hash(s.seed + i * 5.1));
    const r = rT * maxR;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (!cellPresent(px, py, w, h, s, i, 0)) continue;
    const sizeMin = 6 * s.shapeScale;
    const sizeMax = 36 * s.shapeScale;
    const sx = sizeMin + hash(s.seed + i * 7.3) * (sizeMax - sizeMin);
    const sy = sx * (0.25 + hash(s.seed + i * 11.7) * 0.55);
    cells.push(
      quadCell(
        { x: px - sx / 2, y: py - sy / 2 },
        { x: px + sx / 2, y: py - sy / 2 },
        { x: px + sx / 2, y: py + sy / 2 },
        { x: px - sx / 2, y: py + sy / 2 },
        w,
        h,
        s,
        pickColor(palette, i, 0, s),
      ),
    );
  }
  return cells;
};

// INK_SPIRAL — Archimedean spiral unwinding from the centre. Each
// step places a quad whose size grows with the spiral's radius; the
// warp field's twist/pinch then bends the whole spiral into the
// signature "ink dropping into water" form.
const buildInkSpiral = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const cx = w / 2;
  const cy = h / 2;
  const maxR = (Math.min(w, h) / 2) * 0.9;
  // Lower turn count + sparser steps so the spiral reads as
  // distinct arcs rather than a solid swirl. Tunable via
  // shapeDensity but capped tighter than before.
  const turns = 3.2;
  const totalAngle = turns * Math.PI * 2;
  const stepsPerTurn = Math.max(8, Math.floor(s.shapeDensity * 0.65));
  const steps = Math.floor(turns * stepsPerTurn);
  const cells: GridCell[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const a = t * totalAngle;
    const r = t * maxR;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (!cellPresent(px, py, w, h, s, i, 0)) continue;
    // Cell size grows along the spiral so the rim reads as bold ink.
    // Reduced from earlier so neighbouring cells stop overlapping.
    const base = (6 + t * 24) * s.shapeScale;
    const halfRad = base * 0.22;
    const halfTan = base * 0.42;
    const spiralCell = quadCell(
      { x: px - halfRad, y: py - halfTan },
      { x: px + halfRad, y: py - halfTan },
      { x: px + halfRad, y: py + halfTan },
      { x: px - halfRad, y: py + halfTan },
      w,
      h,
      s,
      pickColor(palette, i, Math.floor(t * 5), s),
    );
    // Reveal along the spiral — inner cells (small t) first, then
    // the spiral unwinds outward through each cell in order.
    spiralCell.revealOrder = t;
    cells.push(spiralCell);
  }
  return cells;
};

// SQUISHY_BLOBS — soft, organic blob cells distributed across a
// jittered grid. Each blob is a closed sine-harmonic outline whose
// every sample point is run through the warp field, so distortion,
// outward, pinch, and curvature physically squish the blobs (instead
// of leaving them as flat circles). Asymmetry squashes them into
// ovals. Density controls how many blobs fit on the field; scale
// controls each blob's radius. Reads as soft bubbles under pressure.
const buildSquishyBlobs = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const density = Math.max(4, Math.floor(s.shapeDensity * 0.55));
  // Match cols and rows to the field's aspect so blobs don't squash
  // by accident along the long axis.
  const aspect = w / h;
  const cols = Math.max(2, Math.round(density * Math.sqrt(aspect)));
  const rows = Math.max(2, Math.round(density / Math.sqrt(aspect)));
  const cellW = w / cols;
  const cellH = h / rows;
  const baseR = Math.min(cellW, cellH) * 0.55 * s.shapeScale;
  const N = 24; // points around each blob's perimeter

  const cells: GridCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Jitter each blob's centre inside its grid slot so the field
      // doesn't read as a hard lattice.
      const jx = (hash(s.seed + col * 12.1 + row * 7.3) - 0.5) * cellW * 0.55;
      const jy = (hash(s.seed + col * 9.7 + row * 13.1) - 0.5) * cellH * 0.55;
      const cx = col * cellW + cellW / 2 + jx;
      const cy = row * cellH + cellH / 2 + jy;
      if (!cellPresent(cx, cy, w, h, s, col, row)) continue;

      // Per-blob size variation — keeps the field from feeling
      // mechanical even before warping.
      const sizeVar = 0.55 + hash(s.seed + col * 5.1 + row * 17.3) * 0.7;
      const r = baseR * sizeVar;

      // Asymmetry squashes blobs into ovals with a per-blob bias so
      // the directions vary across the field.
      const asym = (s.asymmetry || 0) / 100;
      const squash = 1 + asym * (hash(s.seed + col * 3.3 + row * 19.7) - 0.5) * 1.2;
      const rx = r * squash;
      const ry = r / squash;

      // Per-blob harmonic phase so no two blobs ripple the same way.
      const phase = hash(s.seed + col * 41.3 + row * 97.1) * Math.PI * 2;
      const wobAmp = 0.14 + hash(s.seed + col + row) * 0.08;

      const pts: string[] = [];
      for (let k = 0; k < N; k++) {
        const a = (k / N) * Math.PI * 2;
        // Two-harmonic outline wobble.
        const wob =
          Math.sin(a * 3 + phase) * wobAmp +
          Math.sin(a * 5 + phase * 1.7) * wobAmp * 0.4;
        const radial = 1 + wob;
        const localX = cx + Math.cos(a) * rx * radial;
        const localY = cy + Math.sin(a) * ry * radial;
        // Push every perimeter sample through the field — this is
        // what makes the blob "squishy" rather than merely rounded.
        const wp = warpPoint(localX, localY, w, h, s);
        pts.push(`${k === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
      }
      pts.push("Z");

      cells.push({
        d: pts.join(" "),
        color: pickColor(palette, col, row, s),
        cx,
        cy,
      });
    }
  }
  return cells;
};

// Build an SVG `d` for a single polar quad cell (r1..r2 × a1..a2)
// whose perimeter samples have all been pushed through the warp
// field. Shared by every polar builder that needs warped wedges.
const polarCellPath = (
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  a1: number,
  a2: number,
  w: number,
  h: number,
  s: CellGridSettings,
  subs = 10,
): string => {
  const pts: string[] = [];
  for (let i = 0; i <= subs; i++) {
    const t = i / subs;
    const a = a1 + (a2 - a1) * t;
    const r = Math.max(0.001, r1);
    const wp = warpPoint(cx + Math.cos(a) * r, cy + Math.sin(a) * r, w, h, s);
    pts.push(`${i === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
  }
  for (let i = 0; i <= subs; i++) {
    const t = i / subs;
    const a = a2 - (a2 - a1) * t;
    const wp = warpPoint(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2, w, h, s);
    pts.push(`L ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
  }
  pts.push("Z");
  return pts.join(" ");
};

// RADIAL_CHECKER — polar checker grid: N angular wedges × M rings,
// alternating fill in a 2D checker so the disc reads as a target with
// pinwheel rotation. One wedge is "exploded" into many narrow
// sub-wedges (fan effect at that focal angle). Like the rest of the
// builders, every polar cell's perimeter is warpPoint()'d so
// distortion/outward/pinch/curvature deform the disc into something
// non-circular under pressure.
const buildRadialChecker = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const cx = w / 2;
  const cy = h / 2;
  // Outer radius respects margin; baseline is half the shorter side.
  const maxR = (Math.min(w, h) / 2) * 0.95;
  const marginShrink = Math.min(0.6, (s.margin / 200) * 0.6);
  const outerR = maxR * (1 - marginShrink) * s.shapeScale;

  const wedges = Math.max(4, Math.floor(s.shapeDensity * 0.45));
  const rings = Math.max(2, Math.floor(s.shapeDensity * 0.18));
  // Which wedge "explodes" — deterministic from seed.
  const explodeIdx = Math.floor(hash(s.seed * 1.17) * wedges);
  const SUB_WEDGES = 7;

  // Two palette anchors that read as a true checker. The studio's
  // expanded palette is round-robin'd from the 3-colour source, so
  // naively picking palette[0] and palette[mid] often returns the same
  // hex. Scan for the first colour that actually differs from
  // palette[0]; fall back to palette[0] only if every slot is the same.
  const colA = palette[0]!;
  let colB = colA;
  for (let i = 1; i < palette.length; i++) {
    if (palette[i] !== colA) {
      colB = palette[i]!;
      break;
    }
  }

  // Light per-cell colour jitter via colorRandomness so the disc isn't
  // a perfect 2-tone — keeps the rest of the colour controls relevant.
  const randomness = s.colorRandomness / 100;

  const cells: GridCell[] = [];

  for (let wi = 0; wi < wedges; wi++) {
    const wedgeA1 = (wi / wedges) * Math.PI * 2 - Math.PI / 2;
    const wedgeA2 = ((wi + 1) / wedges) * Math.PI * 2 - Math.PI / 2;
    const isExplode = wi === explodeIdx;
    const subCount = isExplode ? SUB_WEDGES : 1;

    for (let sw = 0; sw < subCount; sw++) {
      const a1 = wedgeA1 + ((wedgeA2 - wedgeA1) * sw) / subCount;
      const a2 = wedgeA1 + ((wedgeA2 - wedgeA1) * (sw + 1)) / subCount;
      const angleIdx = isExplode ? wi * SUB_WEDGES + sw : wi;

      for (let ri = 0; ri < rings; ri++) {
        const r1 = (ri / rings) * outerR;
        const r2 = ((ri + 1) / rings) * outerR;
        // Centroid in the unwarped polar grid — used as the cell anchor
        // for per-cell stagger animation.
        const ac = (a1 + a2) / 2;
        const rc = (r1 + r2) / 2;
        const centroidX = cx + Math.cos(ac) * rc;
        const centroidY = cy + Math.sin(ac) * rc;
        if (!cellPresent(centroidX, centroidY, w, h, s, angleIdx, ri)) continue;

        // 2D checker — parity from (wedge + ring).
        const checker = (angleIdx + ri) % 2;
        let color = checker === 0 ? colA : colB;
        // Small randomness budget — swap in a palette pick now and then.
        if (hash(s.seed + angleIdx * 13.7 + ri * 5.1) < randomness) {
          color = pickColor(palette, angleIdx, ri, s);
        }

        cells.push({
          d: polarCellPath(cx, cy, r1, r2, a1, a2, w, h, s),
          color,
          cx: centroidX,
          cy: centroidY,
        });
      }
    }
  }

  return cells;
};

// OPTICAL_DIAL — concentric rings each with their own wedge count
// (picked from a small palette of divisors), checkerboard-filled, with
// one "broken" ring shattered into thin radial lines and an inner
// solid puck. Reads as an optical calibration target collapsing into
// itself under the warp field.
const buildOpticalDial = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const cx = w / 2;
  const cy = h / 2;
  const maxR = (Math.min(w, h) / 2) * 0.95;
  const marginShrink = Math.min(0.6, (s.margin / 200) * 0.6);
  const outerR = maxR * (1 - marginShrink) * s.shapeScale;

  const colA = palette[0]!;
  let colB = colA;
  for (let i = 1; i < palette.length; i++) {
    if (palette[i] !== colA) {
      colB = palette[i]!;
      break;
    }
  }

  const rings = Math.max(3, Math.min(7, Math.floor(s.shapeDensity * 0.22)));
  const WEDGE_CHOICES = [6, 8, 10, 12, 16, 20];
  // The "broken" ring is ~3/4 of the way out — thin radial lines for
  // the warped pie-chart-division detail in the reference image.
  const brokenRing = Math.floor((rings - 1) * 0.75);
  const cells: GridCell[] = [];

  for (let ri = 0; ri < rings; ri++) {
    const r1 = (ri / rings) * outerR;
    const r2 = ((ri + 1) / rings) * outerR;
    const wedges =
      WEDGE_CHOICES[Math.floor(hash(s.seed + ri * 7.3) * WEDGE_CHOICES.length)]!;
    // Alternate ring rotation offset so adjacent rings don't share
    // angular boundaries — the calibration-target fragmentation.
    const ringRot = (ri % 2 === 0 ? 1 : -1) * (Math.PI / wedges) * 0.5;
    const isBroken = ri === brokenRing;
    // Broken ring: each main wedge splits into 5 thin radial slices.
    const innerSubs = isBroken ? 5 : 1;

    for (let wi = 0; wi < wedges; wi++) {
      const wA1 = (wi / wedges) * Math.PI * 2 - Math.PI / 2 + ringRot;
      const wA2 = ((wi + 1) / wedges) * Math.PI * 2 - Math.PI / 2 + ringRot;

      for (let sw = 0; sw < innerSubs; sw++) {
        const a1 = wA1 + ((wA2 - wA1) * sw) / innerSubs;
        const a2 = wA1 + ((wA2 - wA1) * (sw + 1)) / innerSubs;
        const ac = (a1 + a2) / 2;
        const rc = (r1 + r2) / 2;
        const centroidX = cx + Math.cos(ac) * rc;
        const centroidY = cy + Math.sin(ac) * rc;
        if (!cellPresent(centroidX, centroidY, w, h, s, wi * innerSubs + sw, ri)) continue;
        const checker = (wi + ri + (isBroken ? sw : 0)) % 2;
        cells.push({
          d: polarCellPath(cx, cy, r1, r2, a1, a2, w, h, s),
          color: checker === 0 ? colA : colB,
          cx: centroidX,
          cy: centroidY,
        });
      }
    }
  }

  return cells;
};

// PIXEL_TOPOGRAPHY — Cartesian grid of chunky rect "pixels" whose
// fill colour is driven by a layered-sine height field, quantised
// into discrete palette bands. The geometry stays sharp (no warp
// subdivisions) so the result reads as resolved-pixel topography
// instead of a smooth gradient — heatmap / elevation-curve feel
// constrained by grid logic.
// Hex → rgba so the per-cell alpha-vignette below can fade colours
// to transparent without changing the palette upstream.
const hexToRgba = (hex: string, alpha: number): string => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
};

const buildPixelTopography = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const density = Math.max(8, Math.floor(s.shapeDensity * 1.4));
  const stepX = w / density;
  const stepY = h / density;
  const scale = s.shapeScale;
  const cells: GridCell[] = [];

  // Height-field controls map onto existing knobs:
  //   curvature → horizontal frequency
  //   asymmetry → vertical frequency
  //   colorClustering → contour-band count compression
  const freqX = 1.8 + (s.curvature / 180) * 4.5;
  const freqY = 1.4 + (s.asymmetry / 100) * 3.5;
  const seedShift = s.seed * 0.013;
  const bandCount = Math.max(2, Math.min(palette.length, 4 + Math.floor(s.colorClustering / 25)));

  // Ball-edge vignette — alpha + cell-size both fall off with
  // distance from the canvas centre. Inside ~55% of the radius
  // pixels are fully solid; past that they soften and shrink so the
  // silhouette reads as a sphere with rounded falloff at the rim
  // instead of a hard rectangular grid edge.
  const cx0 = w / 2;
  const cy0 = h / 2;
  const maxR = Math.min(w, h) / 2;
  const SOLID_T = 0.55; // inside this fraction of radius = full alpha

  for (let iy = 0; iy < density; iy++) {
    for (let ix = 0; ix < density; ix++) {
      const cellCX = ix * stepX + stepX / 2;
      const cellCY = iy * stepY + stepY / 2;
      if (!cellPresent(cellCX, cellCY, w, h, s, ix, iy)) continue;

      const u = cellCX / w;
      const v = cellCY / h;
      const height =
        Math.sin(u * Math.PI * freqX + seedShift) +
        Math.sin(v * Math.PI * freqY + seedShift * 1.7) * 0.85 +
        Math.sin((u + v) * Math.PI * 2.2 + seedShift * 0.5) * 0.55 +
        Math.sin((u - v) * Math.PI * 3.1 + seedShift * 2.1) * 0.35;
      // Map to 0..1
      const t = Math.max(0, Math.min(1, (height + 2.75) / 5.5));
      const band = Math.min(bandCount - 1, Math.floor(t * bandCount));
      // Stretch band index over the full palette so a 3-colour palette
      // expanded to 12 slots still maps to its distinct hues.
      const colIdx = Math.floor((band / Math.max(1, bandCount - 1)) * (palette.length - 1));
      const baseColor = palette[Math.max(0, Math.min(palette.length - 1, colIdx))]!;

      // Distance-from-centre 0..1+ — inside the bounding disc this
      // ranges 0..1; corner cells exceed 1 (≈√2). Falloff curve is
      // smoothstep-ish so the rim feels rounded, not linear.
      const distNorm = Math.hypot(cellCX - cx0, cellCY - cy0) / maxR;
      const falloff = Math.max(0, (1 - distNorm) / (1 - SOLID_T));
      const fade = Math.min(1, falloff); // 1 inside SOLID_T, smoothly → 0
      const alpha = fade * fade * (3 - 2 * fade); // smoothstep
      if (alpha < 0.02) continue; // drop nearly-transparent pixels

      // Cell size also shrinks toward the rim so the sphere edge
      // dissolves structurally on top of the alpha fade.
      const sizeShrink = 0.55 + 0.45 * alpha;
      const dx = stepX * scale * sizeShrink;
      const dy = stepY * scale * sizeShrink;
      const color = alpha >= 0.999 ? baseColor : hexToRgba(baseColor, alpha);

      cells.push({
        x: cellCX - dx / 2,
        y: cellCY - dy / 2,
        w: dx,
        h: dy,
        color,
        cx: cellCX,
        cy: cellCY,
      });
    }
  }
  return cells;
};

// POSTER_STACK — Layered generative composite. Three existing shape
// builders stacked into one cell list with seed/scale offsets so the
// layers don't collide identically: a dense halftone-dot field, a
// radial burst overlay, and a wavy warped-band field underneath.
// Reads as a contemporary screen-printed poster composition.
const buildPosterStack = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const cells: GridCell[] = [];

  // Layer 1 — wavy bands set down first so subsequent layers overprint.
  const bandSettings: CellGridSettings = {
    ...s,
    shapeDensity: Math.max(6, Math.floor(s.shapeDensity * 0.55)),
    shapeScale: Math.max(0.6, s.shapeScale),
    seed: s.seed + 53,
  };
  cells.push(...buildWarpedBands(w, h, palette, bandSettings));

  // Layer 2 — radial burst arms emanating from the centre.
  const burstSettings: CellGridSettings = {
    ...s,
    shapeDensity: Math.max(8, Math.floor(s.shapeDensity * 0.6)),
    shapeScale: Math.max(0.55, s.shapeScale * 0.9),
    seed: s.seed + 17,
  };
  cells.push(...buildRadialBurst(w, h, palette, burstSettings));

  // Layer 3 — small halftone-style "dots" on a dense Cartesian grid.
  // The blocks builder gives us warped quads; tiny shapeScale shrinks
  // them to dot proportions while staying inside the same render
  // pipeline.
  const dotSettings: CellGridSettings = {
    ...s,
    shapeDensity: Math.max(12, Math.floor(s.shapeDensity * 1.4)),
    shapeScale: 0.18 + Math.min(0.18, s.shapeScale * 0.25),
    asymmetry: Math.max(0, s.asymmetry - 10),
    seed: s.seed + 113,
  };
  cells.push(...buildBlocks(w, h, palette, dotSettings));

  return cells;
};

// INTERFERENCE_MANDALA — Two radial_checker fields with slight
// rotation + seed offsets so their warp fields drift past each other,
// producing the moiré beat. Simple two-layer composition.
const buildInterferenceMandala = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const cells: GridCell[] = [];
  cells.push(...buildRadialChecker(w, h, palette, s));
  cells.push(
    ...buildRadialChecker(w, h, palette, {
      ...s,
      rotation: s.rotation + 11,
      seed: s.seed + 19,
      shapeDensity: Math.max(8, s.shapeDensity + 3),
    }),
  );
  return cells;
};

// CRESCENT_GRID — Modular field of crescent slivers laid out on a
// Cartesian grid. Each row flips the curl direction (mirror), so
// adjacent rows oppose each other; each column gets a slight
// compression based on its column index, so the grid reads as a
// vibrating interference field rather than a static pattern. Every
// crescent's perimeter is warpPoint()'d so the standard distortion
// knobs deform the whole sheet.
const buildCrescentGrid = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const density = Math.max(4, Math.floor(s.shapeDensity * 0.4));
  const cols = Math.max(3, density);
  const rows = Math.max(3, Math.max(3, Math.floor(density * 0.85)));
  const cellW = w / cols;
  const cellH = h / rows;
  const subs = 12;
  const sliverW = cellW * 0.9 * s.shapeScale;
  const baseAmp = cellH * 0.45 * s.shapeScale;
  const thicknessRatio = 0.55; // inner curve runs at 55% of outer's height
  const cells: GridCell[] = [];

  for (let row = 0; row < rows; row++) {
    const dir = row % 2 === 0 ? 1 : -1; // mirror flip per row
    for (let col = 0; col < cols; col++) {
      const cx = col * cellW + cellW / 2;
      const cy = row * cellH + cellH / 2;
      if (!cellPresent(cx, cy, w, h, s, col, row)) continue;
      // Per-column compression — sinusoidal phase keyed to col+row
      // creates the moiré-like vibration referenced in the brief.
      const compress = 1 - 0.22 * Math.sin(col * 0.78 + row * 1.15 + s.seed * 0.03);
      const amp = baseAmp * compress;

      const pts: string[] = [];
      // Outer parabolic arc — peak at t=0.5.
      for (let i = 0; i <= subs; i++) {
        const t = i / subs;
        const x = cx + (t - 0.5) * sliverW;
        const yOff = dir * amp * (1 - 4 * (t - 0.5) * (t - 0.5));
        const wp = warpPoint(x, cy + yOff, w, h, s);
        pts.push(`${i === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
      }
      // Inner parabolic arc — shallower so the area between reads
      // as a thin crescent sliver.
      for (let i = subs; i >= 0; i--) {
        const t = i / subs;
        const x = cx + (t - 0.5) * sliverW;
        const yOff = dir * amp * thicknessRatio * (1 - 4 * (t - 0.5) * (t - 0.5));
        const wp = warpPoint(x, cy + yOff, w, h, s);
        pts.push(`L ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
      }
      pts.push("Z");

      cells.push({
        d: pts.join(" "),
        color: pickColor(palette, col, row, s),
        cx,
        cy,
      });
    }
  }
  return cells;
};

// SINE_STRIPES — Stack of horizontal bands. Each band's top and
// bottom edges are sampled along the full width and offset by a
// sine wave; per-band phase walks the wave through the stack so the
// bands appear to flow. Curvature drives frequency, shapeScale
// drives amplitude, asymmetry phase-shifts adjacent bands so they
// oppose each other for the elastic-tension feel from the brief.
const buildSineStripes = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const bandCount = Math.max(5, Math.floor(s.shapeDensity * 0.55));
  const bandH = h / bandCount;
  const subs = 28;
  const amp = Math.min(bandH * 0.55, bandH * 0.35 * s.shapeScale + 8);
  const freq = 1.4 + (s.curvature / 180) * 5.5;
  const asymPhase = (s.asymmetry / 100) * Math.PI;
  const seedPhase = (s.seed % 360) * (Math.PI / 180);
  const cells: GridCell[] = [];

  for (let bi = 0; bi < bandCount; bi++) {
    const yCenter = bi * bandH + bandH / 2;
    if (!cellPresent(w / 2, yCenter, w, h, s, 0, bi)) continue;
    // Each band advances the phase; asymmetry rotates the phase
    // step so the stack can read as marching or as opposed pairs.
    const phase = seedPhase + bi * (0.55 + asymPhase * 0.15);
    // Top edge: left to right with sine offset.
    const pts: string[] = [];
    for (let i = 0; i <= subs; i++) {
      const t = i / subs;
      const x = t * w;
      const y = yCenter - bandH * 0.4 +
        Math.sin(t * freq * Math.PI * 2 + phase) * amp;
      const wp = warpPoint(x, y, w, h, s);
      pts.push(`${i === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
    }
    // Bottom edge: right to left. Phase nudged so the band's
    // thickness pulses along its length instead of staying uniform.
    for (let i = subs; i >= 0; i--) {
      const t = i / subs;
      const x = t * w;
      const y = yCenter + bandH * 0.4 +
        Math.sin(t * freq * Math.PI * 2 + phase + Math.PI * 0.55) * amp * 0.85;
      const wp = warpPoint(x, y, w, h, s);
      pts.push(`L ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
    }
    pts.push("Z");

    cells.push({
      d: pts.join(" "),
      color: pickColor(palette, 0, bi, s),
      cx: w / 2,
      cy: yCenter,
    });
  }
  return cells;
};

// Helper: build a warped polygon path with N straight edges.
// Each vertex is run through warpPoint so distortion knobs deform
// the polygon shape under pressure.
const ngonPath = (
  cx: number,
  cy: number,
  r: number,
  sides: number,
  rotation: number,
  w: number,
  h: number,
  s: CellGridSettings,
): string => {
  const pts: string[] = [];
  for (let i = 0; i <= sides; i++) {
    const a = (i / sides) * Math.PI * 2 + rotation;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    const wp = warpPoint(px, py, w, h, s);
    pts.push(`${i === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
  }
  pts.push("Z");
  return pts.join(" ");
};

// Helper: warped ellipse path sampled at N points.
const ellipsePath = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotation: number,
  w: number,
  h: number,
  s: CellGridSettings,
  samples = 20,
): string => {
  const pts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const a = (i / samples) * Math.PI * 2 + rotation;
    const px = cx + Math.cos(a) * rx;
    const py = cy + Math.sin(a) * ry;
    const wp = warpPoint(px, py, w, h, s);
    pts.push(`${i === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
  }
  pts.push("Z");
  return pts.join(" ");
};

// TRIANGLE_GRID — Cartesian grid where each square cell is split
// along its NW→SE diagonal into two right triangles, alternating
// fill colours. Reads as a stained-glass tessellation. Vertices are
// warped, so the field deforms under the warp knobs.
const buildTriangleGrid = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const density = Math.max(4, Math.floor(s.shapeDensity * 0.55));
  const stepX = w / density;
  const stepY = h / density;
  const scale = s.shapeScale;
  const cells: GridCell[] = [];
  const tri = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
  ) => {
    const a = warpPoint(p1.x, p1.y, w, h, s);
    const b = warpPoint(p2.x, p2.y, w, h, s);
    const c = warpPoint(p3.x, p3.y, w, h, s);
    return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)} L ${c.x.toFixed(2)} ${c.y.toFixed(2)} Z`;
  };
  for (let iy = 0; iy < density; iy++) {
    for (let ix = 0; ix < density; ix++) {
      const x1 = ix * stepX + stepX * (1 - scale) / 2;
      const y1 = iy * stepY + stepY * (1 - scale) / 2;
      const x2 = (ix + 1) * stepX - stepX * (1 - scale) / 2;
      const y2 = (iy + 1) * stepY - stepY * (1 - scale) / 2;
      const cellCX = (x1 + x2) / 2;
      const cellCY = (y1 + y2) / 2;
      if (!cellPresent(cellCX, cellCY, w, h, s, ix, iy)) continue;
      // NW triangle.
      cells.push({
        d: tri({ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x1, y: y2 }),
        color: pickColor(palette, ix * 2, iy, s),
        cx: (x1 + x2 + x1) / 3,
        cy: (y1 + y1 + y2) / 3,
      });
      // SE triangle.
      cells.push({
        d: tri({ x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }),
        color: pickColor(palette, ix * 2 + 1, iy, s),
        cx: (x2 + x2 + x1) / 3,
        cy: (y1 + y2 + y2) / 3,
      });
    }
  }
  return cells;
};

// HEXAGON_GRID — Offset honeycomb of regular hexagons with per-cell
// rotation jitter, size jitter, and a secondary tier of half-size
// "infill" hexes packed between the primary cells so the field reads
// as noisy + rhythmic rather than a clean tessellation.
const buildHexagonGrid = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const density = Math.max(3, Math.floor(s.shapeDensity * 0.4));
  const r = Math.min(w, h) / density / 2;
  const hexW = Math.sqrt(3) * r;
  const hexH = 2 * r;
  const colStep = hexW;
  const rowStep = hexH * 0.75;
  const cols = Math.ceil(w / colStep) + 1;
  const rows = Math.ceil(h / rowStep) + 1;
  const baseRadius = r * s.shapeScale * 0.96;
  const cells: GridCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = col * colStep + (row % 2 === 1 ? hexW / 2 : 0);
      const cy = row * rowStep;
      if (!cellPresent(cx, cy, w, h, s, col, row)) continue;
      // Tangent-clockwise rotation around the field's centre + a
      // per-cell jitter so the honeycomb doesn't tessellate flat.
      const tangent = Math.atan2(cy - h / 2, cx - w / 2) + Math.PI / 2;
      const jitter = (hash(s.seed + col * 3.7 + row * 11.13) - 0.5) * 0.7;
      const rot = -Math.PI / 2 + tangent * 0.18 + jitter;
      // Size jitter — half the cells shrink, giving a stacked / noisy read.
      const sizeRand = hash(s.seed + col * 5.1 + row * 7.3);
      const cellR = baseRadius * (0.55 + sizeRand * 0.5);
      cells.push({
        d: ngonPath(cx, cy, cellR, 6, rot, w, h, s),
        color: pickColor(palette, col, row, s),
        cx,
        cy,
      });
      // Infill: every ~3rd cell drops a half-size hex nudged off
      // the lattice so the negative space fills in with smaller
      // primitives.
      if (hash(s.seed + col * 9.7 + row * 13.3) < 0.42) {
        const offsetA = hash(s.seed + col + row) * Math.PI * 2;
        const offsetD = r * 0.5;
        const sx = cx + Math.cos(offsetA) * offsetD;
        const sy = cy + Math.sin(offsetA) * offsetD;
        cells.push({
          d: ngonPath(sx, sy, baseRadius * 0.42, 6,
            rot + Math.PI / 6, w, h, s),
          color: pickColor(palette, col + 100, row, s),
          cx: sx,
          cy: sy,
        });
      }
    }
  }
  return cells;
};

// ELLIPSE_FIELD — Dense Cartesian grid of ellipses with four modes:
//   wide stroke (rx >> ry), tall stroke (ry >> rx), big mesh cell
//   (~2x normal so neighbours overlap), and standard with jitter.
// Each cell rotates tangent to the field centre for a clockwise
// swirl read, with per-cell jitter so the rotation isn't perfectly
// uniform. Micro-dots fill remaining gaps.
const buildEllipseField = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const density = Math.max(5, Math.floor(s.shapeDensity * 0.65));
  const stepX = w / density;
  const stepY = h / density;
  const scale = s.shapeScale;
  const fx = w / 2;
  const fy = h / 2;
  const cells: GridCell[] = [];
  for (let iy = 0; iy < density; iy++) {
    for (let ix = 0; ix < density; ix++) {
      const cx = ix * stepX + stepX / 2;
      const cy = iy * stepY + stepY / 2;
      if (!cellPresent(cx, cy, w, h, s, ix, iy)) continue;
      const tangent = Math.atan2(cy - fy, cx - fx) + Math.PI / 2;
      // Mode pick:  0 = wide, 1 = tall, 2 = big mesh, 3 = standard.
      const modeRoll = hash(s.seed + ix * 3.7 + iy * 11.13);
      const mode =
        modeRoll < 0.25 ? 0 :
        modeRoll < 0.5  ? 1 :
        modeRoll < 0.7  ? 2 :
        3;
      let rx: number;
      let ry: number;
      let rot = tangent + (hash(s.seed + ix * 9.7 + iy * 13.3) - 0.5) * 0.7;
      switch (mode) {
        case 0: {
          // WIDE stroke — long horizontal sweep tangent to centre.
          rx = stepX * 0.95 * scale;
          ry = stepY * 0.22 * scale;
          break;
        }
        case 1: {
          // TALL stroke — long perpendicular sweep.
          rx = stepX * 0.22 * scale;
          ry = stepY * 0.95 * scale;
          break;
        }
        case 2: {
          // BIG MESH — ~2x normal so neighbouring cells overlap.
          const aspect = 0.7 + hash(s.seed + ix * 5.3 + iy * 11.7) * 0.5;
          rx = stepX * 0.85 * scale * aspect;
          ry = stepY * 0.85 * scale / aspect;
          // Some big mesh cells break alignment for extra chaos.
          if (hash(s.seed + ix * 19.3 + iy * 7.7) < 0.4) {
            rot += Math.PI / 2;
          }
          break;
        }
        default: {
          // STANDARD — moderate jitter.
          const aspectJitterX = 0.45 + hash(s.seed + ix * 3.7 + iy * 7.1) * 0.7;
          const aspectJitterY = 0.45 + hash(s.seed + ix * 5.3 + iy * 11.7) * 0.7;
          rx = stepX * 0.42 * scale * aspectJitterX;
          ry = stepY * 0.42 * scale * aspectJitterY;
        }
      }
      cells.push({
        d: ellipsePath(cx, cy, rx, ry, rot, w, h, s),
        color: pickColor(palette, ix, iy, s),
        cx,
        cy,
      });
      // Micro-dot infill — ~35% of cells drop a tiny dot nudged off
      // the lattice for textural density.
      if (hash(s.seed + ix * 17.7 + iy * 23.3) < 0.35) {
        const offA = hash(s.seed + ix + iy) * Math.PI * 2;
        const offD = Math.min(stepX, stepY) * 0.45;
        const sx = cx + Math.cos(offA) * offD;
        const sy = cy + Math.sin(offA) * offD;
        const dotR = Math.min(stepX, stepY) * 0.13 * scale;
        cells.push({
          d: ellipsePath(sx, sy, dotR, dotR, 0, w, h, s),
          color: pickColor(palette, ix + 50, iy + 50, s),
          cx: sx,
          cy: sy,
        });
      }
    }
  }
  return cells;
};

// PRIMITIVE_SOUP — Each grid cell picks one of seven primitives at
// random: triangle, square, pentagon, hexagon, octagon, ellipse,
// circle. The result is a maximally diverse field that hits every
// canonical primitive in one shape.
const buildPrimitiveSoup = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const density = Math.max(4, Math.floor(s.shapeDensity * 0.5));
  const stepX = w / density;
  const stepY = h / density;
  const r0 = Math.min(stepX, stepY) * 0.45 * s.shapeScale;
  const cells: GridCell[] = [];
  for (let iy = 0; iy < density; iy++) {
    for (let ix = 0; ix < density; ix++) {
      const cx = ix * stepX + stepX / 2;
      const cy = iy * stepY + stepY / 2;
      if (!cellPresent(cx, cy, w, h, s, ix, iy)) continue;
      const choice = Math.floor(hash(s.seed + ix * 3.7 + iy * 11.13) * 7);
      const rot = hash(s.seed + ix * 7.3 + iy * 5.1) * Math.PI * 2;
      // Small per-cell radius jitter so the field doesn't feel like
      // a regular lattice.
      const r = r0 * (0.75 + hash(s.seed + ix * 17.9 + iy * 23.5) * 0.45);
      let d: string;
      switch (choice) {
        case 0:
          d = ngonPath(cx, cy, r, 3, rot, w, h, s);
          break;
        case 1:
          d = ngonPath(cx, cy, r, 4, rot, w, h, s);
          break;
        case 2:
          d = ngonPath(cx, cy, r, 5, rot, w, h, s);
          break;
        case 3:
          d = ngonPath(cx, cy, r, 6, rot, w, h, s);
          break;
        case 4:
          d = ngonPath(cx, cy, r, 8, rot, w, h, s);
          break;
        case 5:
          d = ellipsePath(cx, cy, r, r * 0.6, rot, w, h, s);
          break;
        default:
          d = ellipsePath(cx, cy, r, r, 0, w, h, s);
          break;
      }
      cells.push({
        d,
        color: pickColor(palette, ix, iy, s),
        cx,
        cy,
      });
    }
  }
  return cells;
};

// POLYGON_MIX — Polygons only (no curved primitives). Each cell on
// a hex-offset lattice picks a polygon kind (3-8 sides) at a jittered
// size, plus an extra tier of small polygons packed between cells.
// Designed to read as "a field composed of many different polygons".
const buildPolygonMix = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const density = Math.max(3, Math.floor(s.shapeDensity * 0.42));
  // Hex-offset lattice — same spacing as buildHexagonGrid so the
  // mix flows like a honeycomb of varied polygons.
  const r = Math.min(w, h) / density / 2;
  const hexW = Math.sqrt(3) * r;
  const hexH = 2 * r;
  const colStep = hexW;
  const rowStep = hexH * 0.75;
  const cols = Math.ceil(w / colStep) + 1;
  const rows = Math.ceil(h / rowStep) + 1;
  const baseRadius = r * s.shapeScale * 0.96;
  const cells: GridCell[] = [];
  // Polygon side-count menu (no ellipses/circles).
  const SIDES = [3, 4, 5, 6, 7, 8];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = col * colStep + (row % 2 === 1 ? hexW / 2 : 0);
      const cy = row * rowStep;
      if (!cellPresent(cx, cy, w, h, s, col, row)) continue;
      // Per-cell polygon kind + size + rotation.
      const sidesIdx = Math.floor(hash(s.seed + col * 3.7 + row * 11.13) * SIDES.length);
      const sides = SIDES[sidesIdx]!;
      const sizeRand = hash(s.seed + col * 5.1 + row * 7.3);
      const cellR = baseRadius * (0.5 + sizeRand * 0.8);
      const tangent = Math.atan2(cy - h / 2, cx - w / 2) + Math.PI / 2;
      const rotJitter = (hash(s.seed + col * 19.3 + row * 23.7) - 0.5) * 1.2;
      const rot = -Math.PI / 2 + tangent * 0.18 + rotJitter;
      cells.push({
        d: ngonPath(cx, cy, cellR, sides, rot, w, h, s),
        color: pickColor(palette, col, row, s),
        cx,
        cy,
      });
      // Infill polygon: ~45% of cells drop a small polygon nudged
      // off the lattice, with a different kind so the gaps fill
      // with varied primitives.
      if (hash(s.seed + col * 9.7 + row * 13.3) < 0.45) {
        const offsetA = hash(s.seed + col + row) * Math.PI * 2;
        const offsetD = r * 0.45;
        const sx = cx + Math.cos(offsetA) * offsetD;
        const sy = cy + Math.sin(offsetA) * offsetD;
        const sideAlt = SIDES[(sidesIdx + 2) % SIDES.length]!;
        cells.push({
          d: ngonPath(sx, sy, baseRadius * 0.38, sideAlt,
            rot + Math.PI / sideAlt, w, h, s),
          color: pickColor(palette, col + 100, row, s),
          cx: sx,
          cy: sy,
        });
      }
    }
  }
  return cells;
};

// Random point inside a triangle via barycentric coordinates.
const randInTri = (a: V2, b: V2, c: V2, r1: number, r2: number): V2 => {
  let u = r1;
  let v = r2;
  if (u + v > 1) {
    u = 1 - u;
    v = 1 - v;
  }
  return {
    x: a.x + u * (b.x - a.x) + v * (c.x - a.x),
    y: a.y + u * (b.y - a.y) + v * (c.y - a.y),
  };
};

// Triangulate a convex polygon as a fan from its first vertex.
const fanTriangulate = (poly: V2[]): [V2, V2, V2][] => {
  const tris: [V2, V2, V2][] = [];
  for (let i = 1; i < poly.length - 1; i++) {
    tris.push([poly[0]!, poly[i]!, poly[i + 1]!]);
  }
  return tris;
};

// Sample N points uniformly inside a polygon (triangle-fan based).
const samplePointsInPoly = (
  poly: V2[],
  count: number,
  seed: number,
): V2[] => {
  if (poly.length < 3) return [];
  const tris = fanTriangulate(poly);
  // Compute triangle areas for weighted sampling.
  const areas = tris.map((t) =>
    Math.abs(
      (t[1].x - t[0].x) * (t[2].y - t[0].y) -
        (t[2].x - t[0].x) * (t[1].y - t[0].y),
    ) / 2,
  );
  const totalA = areas.reduce((a, b) => a + b, 0);
  if (totalA <= 0) return [];
  const out: V2[] = [];
  for (let i = 0; i < count; i++) {
    // Pick triangle weighted by area.
    const r = hash(seed + i * 17.3) * totalA;
    let acc = 0;
    let pick = tris[0]!;
    for (let j = 0; j < tris.length; j++) {
      acc += areas[j]!;
      if (r <= acc) {
        pick = tris[j]!;
        break;
      }
    }
    const r1 = hash(seed + i * 5.1);
    const r2 = hash(seed + i * 11.3);
    out.push(randInTri(pick[0], pick[1], pick[2], r1, r2));
  }
  return out;
};

// Place a small polygon particle inside a parent cell. Used by
// Voronoi, Delaunay, and polygon_mix to fill each cell with many
// smaller same-family particles.
const particleAt = (
  p: V2,
  hostSeed: number,
  baseR: number,
  w: number,
  h: number,
  s: CellGridSettings,
  palette: string[],
  paletteIdxA: number,
  paletteIdxB: number,
): GridCell => {
  // Pick polygon side count from a small menu so particles vary
  // morphologically without becoming chaotic.
  const SIDES = [3, 4, 5, 6, 8];
  const sideIdx = Math.floor(hash(hostSeed + 3.7) * SIDES.length);
  const sides = SIDES[sideIdx]!;
  const sizeRand = 0.4 + hash(hostSeed + 5.1) * 0.7;
  const r = baseR * sizeRand;
  const rot = hash(hostSeed + 7.3) * Math.PI * 2;
  return {
    d: ngonPath(p.x, p.y, r, sides, rot, w, h, s),
    color: pickColor(palette, paletteIdxA, paletteIdxB, s),
    cx: p.x,
    cy: p.y,
  };
};

// ─────────────────────────────────────────────────────────────────────
// Voronoi + Delaunay helpers
//
// Shared seed placement: a jittered grid keyed by seed setting so the
// pattern is deterministic but doesn't read as a lattice.
type V2 = { x: number; y: number };

const placeSeeds = (
  w: number,
  h: number,
  s: CellGridSettings,
  count: number,
): V2[] => {
  const grid = Math.ceil(Math.sqrt(count * (w / h)));
  const rows = Math.ceil(count / grid);
  const seeds: V2[] = [];
  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < grid; ix++) {
      if (seeds.length >= count) break;
      const baseX = (ix + 0.5) * (w / grid);
      const baseY = (iy + 0.5) * (h / rows);
      const jx = (hash(s.seed + ix * 3.7 + iy * 11.13) - 0.5) * (w / grid) * 0.9;
      const jy = (hash(s.seed + ix * 5.3 + iy * 7.7) - 0.5) * (h / rows) * 0.9;
      seeds.push({ x: baseX + jx, y: baseY + jy });
    }
  }
  return seeds;
};

// Sutherland-Hodgman half-plane clip: keep points of `poly` that are
// on `seed`'s side of the perpendicular bisector with `other`.
const clipHalfPlane = (poly: V2[], seed: V2, other: V2): V2[] => {
  const mx = (seed.x + other.x) / 2;
  const my = (seed.y + other.y) / 2;
  const dx = other.x - seed.x;
  const dy = other.y - seed.y;
  const sideOf = (p: V2) => (p.x - mx) * dx + (p.y - my) * dy;
  const out: V2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i]!;
    const nxt = poly[(i + 1) % poly.length]!;
    const cSide = sideOf(cur);
    const nSide = sideOf(nxt);
    const cIn = cSide <= 0;
    const nIn = nSide <= 0;
    if (cIn) out.push(cur);
    if (cIn !== nIn) {
      const t = cSide / (cSide - nSide);
      out.push({
        x: cur.x + t * (nxt.x - cur.x),
        y: cur.y + t * (nxt.y - cur.y),
      });
    }
  }
  return out;
};

// VORONOI_CELLS — organic mosaic rendered as outlined edges. Each
// cell is computed by half-plane clipping; instead of filling the
// resulting polygon we trace its perimeter as a chain of thin warped
// quads. Edges shared between neighbouring cells are de-duped via
// a coordinate-rounded key so each line is drawn once.
const buildVoronoiCells = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const count = Math.max(8, Math.floor(s.shapeDensity * 1.0));
  const seeds = placeSeeds(w, h, s, count);
  const bbox: V2[] = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const cells: GridCell[] = [];
  const lineW = Math.max(1.4, 2.6 * s.shapeScale);
  const seen = new Set<string>();
  const edgeKey = (p: V2, q: V2) => {
    const px = p.x.toFixed(2);
    const py = p.y.toFixed(2);
    const qx = q.x.toFixed(2);
    const qy = q.y.toFixed(2);
    return `${px},${py}|${qx},${qy}` < `${qx},${qy}|${px},${py}`
      ? `${px},${py}|${qx},${qy}`
      : `${qx},${qy}|${px},${py}`;
  };
  const pushEdge = (p: V2, q: V2, idx: number) => {
    const k = edgeKey(p, q);
    if (seen.has(k)) return;
    seen.add(k);
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;
    const nx = (-dy / len) * (lineW / 2);
    const ny = (dx / len) * (lineW / 2);
    const a = warpPoint(p.x + nx, p.y + ny, w, h, s);
    const b = warpPoint(q.x + nx, q.y + ny, w, h, s);
    const c = warpPoint(q.x - nx, q.y - ny, w, h, s);
    const d = warpPoint(p.x - nx, p.y - ny, w, h, s);
    cells.push({
      d: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)} L ${c.x.toFixed(2)} ${c.y.toFixed(2)} L ${d.x.toFixed(2)} ${d.y.toFixed(2)} Z`,
      color: pickColor(palette, idx, 0, s),
      cx: (p.x + q.x) / 2,
      cy: (p.y + q.y) / 2,
    });
  };
  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i]!;
    let poly: V2[] = bbox.slice();
    for (let j = 0; j < seeds.length; j++) {
      if (j === i) continue;
      poly = clipHalfPlane(poly, seed, seeds[j]!);
      if (poly.length === 0) break;
    }
    if (poly.length < 3) continue;
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k]!;
      const b = poly[(k + 1) % poly.length]!;
      pushEdge(a, b, i + k);
    }
  }
  return cells;
};

// Circumcircle of three points — used by Bowyer-Watson.
const circumcircle = (a: V2, b: V2, c: V2) => {
  const D = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(D) < 1e-9) return { cx: 0, cy: 0, r2: Infinity };
  const aSq = a.x * a.x + a.y * a.y;
  const bSq = b.x * b.x + b.y * b.y;
  const cSq = c.x * c.x + c.y * c.y;
  const cx = (aSq * (b.y - c.y) + bSq * (c.y - a.y) + cSq * (a.y - b.y)) / D;
  const cy = (aSq * (c.x - b.x) + bSq * (a.x - c.x) + cSq * (b.x - a.x)) / D;
  const r2 = (cx - a.x) ** 2 + (cy - a.y) ** 2;
  return { cx, cy, r2 };
};

// Bowyer-Watson Delaunay triangulation.
const delaunay = (points: V2[], w: number, h: number): [V2, V2, V2][] => {
  const M = 4 * Math.max(w, h);
  const s1: V2 = { x: -M, y: -M };
  const s2: V2 = { x: 3 * M, y: -M };
  const s3: V2 = { x: -M, y: 3 * M };
  let triangles: [V2, V2, V2][] = [[s1, s2, s3]];
  for (const p of points) {
    const bad: [V2, V2, V2][] = [];
    for (const t of triangles) {
      const cc = circumcircle(t[0], t[1], t[2]);
      if ((p.x - cc.cx) ** 2 + (p.y - cc.cy) ** 2 < cc.r2) bad.push(t);
    }
    const sameEdge = (a1: V2, a2: V2, b1: V2, b2: V2) =>
      (a1 === b1 && a2 === b2) || (a1 === b2 && a2 === b1);
    const boundary: [V2, V2][] = [];
    for (const t of bad) {
      const tris: [V2, V2][] = [
        [t[0], t[1]],
        [t[1], t[2]],
        [t[2], t[0]],
      ];
      for (const e of tris) {
        let shared = false;
        for (const ot of bad) {
          if (ot === t) continue;
          const oe: [V2, V2][] = [
            [ot[0], ot[1]],
            [ot[1], ot[2]],
            [ot[2], ot[0]],
          ];
          if (oe.some((x) => sameEdge(x[0], x[1], e[0], e[1]))) {
            shared = true;
            break;
          }
        }
        if (!shared) boundary.push(e);
      }
    }
    triangles = triangles.filter((t) => !bad.includes(t));
    for (const e of boundary) triangles.push([e[0], e[1], p]);
  }
  const isSuper = (p: V2) => p === s1 || p === s2 || p === s3;
  return triangles.filter(
    (t) => !isSuper(t[0]) && !isSuper(t[1]) && !isSuper(t[2]),
  );
};

// DELAUNAY_MESH — Bowyer-Watson triangulation rendered as outlined
// edges. Every triangle edge becomes a thin warped quad — the mesh
// reads as a structural wireframe skeleton, not a filled tessellation.
const buildDelaunayMesh = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const count = Math.max(8, Math.floor(s.shapeDensity * 1.0));
  const seeds = placeSeeds(w, h, s, count);
  const tris = delaunay(seeds, w, h);
  const cells: GridCell[] = [];
  const lineW = Math.max(1.4, 2.6 * s.shapeScale);
  // De-dupe shared edges so each line is only rendered once.
  const seen = new Set<string>();
  const edgeKey = (p: V2, q: V2) => {
    // Order independent: smaller (x,y) first.
    const a = p.x + p.y * 9999;
    const b = q.x + q.y * 9999;
    return a < b
      ? `${p.x.toFixed(2)},${p.y.toFixed(2)}|${q.x.toFixed(2)},${q.y.toFixed(2)}`
      : `${q.x.toFixed(2)},${q.y.toFixed(2)}|${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  };
  const pushEdge = (p: V2, q: V2, idx: number) => {
    const k = edgeKey(p, q);
    if (seen.has(k)) return;
    seen.add(k);
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;
    const nx = (-dy / len) * (lineW / 2);
    const ny = (dx / len) * (lineW / 2);
    const a = warpPoint(p.x + nx, p.y + ny, w, h, s);
    const b = warpPoint(q.x + nx, q.y + ny, w, h, s);
    const c = warpPoint(q.x - nx, q.y - ny, w, h, s);
    const d = warpPoint(p.x - nx, p.y - ny, w, h, s);
    cells.push({
      d: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)} L ${c.x.toFixed(2)} ${c.y.toFixed(2)} L ${d.x.toFixed(2)} ${d.y.toFixed(2)} Z`,
      color: pickColor(palette, idx, 0, s),
      cx: (p.x + q.x) / 2,
      cy: (p.y + q.y) / 2,
    });
  };
  tris.forEach((t, i) => {
    pushEdge(t[0], t[1], i);
    pushEdge(t[1], t[2], i + 1);
    pushEdge(t[2], t[0], i + 2);
  });
  return cells;
};

// MESH_GRADIENT — Wireframe outline mesh inspired by gradient-mesh
// composition tools. A square lattice of control points is jittered
// + warped, and every horizontal / vertical edge between adjacent
// control points is rendered as a thin filled quad coloured by a
// position-dependent palette pick. The result reads as a stepped
// gradient mesh outline rather than a solid fill.
const buildMeshGradient = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const density = Math.max(4, Math.floor(s.shapeDensity * 0.45));
  const cols = density;
  const rows = density;
  const stepX = w / cols;
  const stepY = h / rows;
  // Line stroke thickness scales with shapeScale; capped so it
  // doesn't read as fill at high values.
  const lineW = Math.max(1.2, 2.6 * s.shapeScale);
  // Per-vertex jitter for organic feel.
  const jitterStrength = 0.18 * s.shapeScale;

  const grid: V2[][] = [];
  for (let iy = 0; iy <= rows; iy++) {
    const row: V2[] = [];
    for (let ix = 0; ix <= cols; ix++) {
      const baseX = ix * stepX;
      const baseY = iy * stepY;
      const jx =
        (hash(s.seed + ix * 3.7 + iy * 11.13) - 0.5) * stepX * jitterStrength;
      const jy =
        (hash(s.seed + ix * 5.3 + iy * 7.7) - 0.5) * stepY * jitterStrength;
      row.push({ x: baseX + jx, y: baseY + jy });
    }
    grid.push(row);
  }

  const cells: GridCell[] = [];

  // Render a single edge as a thin warped quad.
  const pushEdge = (a: V2, b: V2, ix: number, iy: number) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;
    const nx = (-dy / len) * (lineW / 2);
    const ny = (dx / len) * (lineW / 2);
    const p1 = warpPoint(a.x + nx, a.y + ny, w, h, s);
    const p2 = warpPoint(b.x + nx, b.y + ny, w, h, s);
    const p3 = warpPoint(b.x - nx, b.y - ny, w, h, s);
    const p4 = warpPoint(a.x - nx, a.y - ny, w, h, s);
    cells.push({
      d: `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} L ${p4.x.toFixed(2)} ${p4.y.toFixed(2)} Z`,
      color: pickColor(palette, ix, iy, s),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
    });
  };

  // Horizontal edges.
  for (let iy = 0; iy <= rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      pushEdge(grid[iy]![ix]!, grid[iy]![ix + 1]!, ix, iy);
    }
  }
  // Vertical edges.
  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix <= cols; ix++) {
      pushEdge(grid[iy]![ix]!, grid[iy + 1]![ix]!, ix, iy);
    }
  }
  return cells;
};

// TOPOGRAPHIC_LINES — Concentric thin contour rings with sine-harmonic
// wobble. Each ring's centre is offset along a spiral so the stack
// drifts toward a vanishing point, and each ring's wobble phase
// rotates further than the last, sweeping the wobble peak around the
// disc. The combination reads as a topographic vortex rather than
// flat concentric contours.
const buildTopographicLines = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const cx = w / 2;
  const cy = h / 2;
  // Padded maxR: leaves ~14% margin around the silhouette so the
  // outermost wobble doesn't slam into the canvas edge and read as
  // a clipped ring. The wobble amplitude (ampScale × baseR) sits
  // inside this margin so even the peak crest stays in-bounds.
  const maxR = (Math.min(w, h) / 2) * 0.82;
  const lineCount = Math.max(5, Math.floor(s.shapeDensity * 0.45));
  const lineW = Math.max(1.2, 2.4 * s.shapeScale);
  const samples = 80;
  const freq = 2 + (s.curvature / 180) * 5.5;
  const ampScale = 0.04 + (s.asymmetry / 100) * 0.14;
  // Spiral retired: every ring is anchored to the canvas centre so
  // the contour stack reads as concentric. Per-ring rotation phase
  // is preserved so the wobble peaks still rotate ring-by-ring,
  // keeping the elevation-map look without the off-centre drift.
  const phaseStep = Math.PI * 0.55;
  const cells: GridCell[] = [];

  for (let li = 0; li < lineCount; li++) {
    const ringCx = cx;
    const ringCy = cy;

    const baseR = ((li + 1) / lineCount) * maxR * s.shapeScale;
    const phase =
      li * phaseStep + (s.seed % 360) * (Math.PI / 180);
    const amp = baseR * ampScale;

    const outerPts: V2[] = [];
    const innerPts: V2[] = [];
    for (let i = 0; i <= samples; i++) {
      const a = (i / samples) * Math.PI * 2;
      const wobble =
        Math.sin(a * freq + phase) * amp +
        Math.sin(a * freq * 2.3 + phase * 1.7) * amp * 0.35;
      const r = baseR + wobble;
      const rIn = Math.max(0.5, r - lineW / 2);
      const rOut = r + lineW / 2;
      outerPts.push({
        x: ringCx + Math.cos(a) * rOut,
        y: ringCy + Math.sin(a) * rOut,
      });
      innerPts.push({
        x: ringCx + Math.cos(a) * rIn,
        y: ringCy + Math.sin(a) * rIn,
      });
    }

    const parts: string[] = [];
    outerPts.forEach((p, i) => {
      const wp = warpPoint(p.x, p.y, w, h, s);
      parts.push(`${i === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
    });
    for (let i = innerPts.length - 1; i >= 0; i--) {
      const p = innerPts[i]!;
      const wp = warpPoint(p.x, p.y, w, h, s);
      parts.push(`L ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
    }
    parts.push("Z");

    cells.push({
      d: parts.join(" "),
      color: pickColor(palette, li, 0, s),
      cx: ringCx,
      cy: ringCy,
    });
  }
  return cells;
};

// Helper: outline an N-gon as a chain of thin warped quads, one per
// edge. Each edge becomes its own GridCell so the per-cell stagger
// reveals the polygon edge by edge.
const outlineNgonAsEdges = (
  cx: number,
  cy: number,
  r: number,
  sides: number,
  rotation: number,
  lineW: number,
  color: string,
  w: number,
  h: number,
  s: CellGridSettings,
  out: GridCell[],
): void => {
  const verts: V2[] = [];
  for (let i = 0; i < sides; i++) {
    const ang = (i / sides) * Math.PI * 2 + rotation;
    verts.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
  }
  for (let i = 0; i < sides; i++) {
    const p = verts[i]!;
    const q = verts[(i + 1) % sides]!;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) continue;
    const nx = (-dy / len) * (lineW / 2);
    const ny = (dx / len) * (lineW / 2);
    const a = warpPoint(p.x + nx, p.y + ny, w, h, s);
    const b = warpPoint(q.x + nx, q.y + ny, w, h, s);
    const c = warpPoint(q.x - nx, q.y - ny, w, h, s);
    const d = warpPoint(p.x - nx, p.y - ny, w, h, s);
    out.push({
      d: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)} L ${c.x.toFixed(2)} ${c.y.toFixed(2)} L ${d.x.toFixed(2)} ${d.y.toFixed(2)} Z`,
      color,
      cx: (p.x + q.x) / 2,
      cy: (p.y + q.y) / 2,
    });
  }
};

// POLYGON_COMPOSITE — Outlined polygon silhouette implicitly defined
// by a cluster of polygon-outline particles in dramatically varied
// sizes. Two tiers — primary + micro — both rendered as wireframe
// edges so the field reads as a structural lacework of polygon
// outlines at many scales, not a colour-filled mosaic.
const buildPolygonComposite = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const cx = w / 2;
  const cy = h / 2;
  const maxR = (Math.min(w, h) / 2) * 0.92 * s.shapeScale;
  const OUTER_SIDES = [6, 7, 8];
  const outerSides = OUTER_SIDES[
    Math.floor(hash(s.seed) * OUTER_SIDES.length)
  ]!;
  const outerRot = -Math.PI / 2;
  const outerPoly: V2[] = [];
  for (let i = 0; i < outerSides; i++) {
    const a = (i / outerSides) * Math.PI * 2 + outerRot;
    outerPoly.push({
      x: cx + Math.cos(a) * maxR,
      y: cy + Math.sin(a) * maxR,
    });
  }

  const SIDES = [3, 4, 5, 6, 7, 8];
  const polyArea = (maxR * maxR * outerSides * Math.sin((2 * Math.PI) / outerSides)) / 2;
  const cells: GridCell[] = [];
  const lineW = Math.max(1.2, 2.2 * s.shapeScale);

  // Tier 1 — primary outlines (sizes 0.35× to 1.45× baseR).
  const primaryCount = Math.max(16, Math.floor(s.shapeDensity * 1.0));
  const baseR = Math.sqrt(polyArea / primaryCount) * 0.95;
  const primarySamples = samplePointsInPoly(outerPoly, primaryCount, s.seed);
  primarySamples.forEach((p, k) => {
    const sides = SIDES[Math.floor(hash(s.seed + k * 3.7) * SIDES.length)]!;
    const sizeRand = 0.35 + hash(s.seed + k * 5.1) * 1.1;
    const r = baseR * sizeRand;
    const rot = hash(s.seed + k * 7.3) * Math.PI * 2;
    outlineNgonAsEdges(
      p.x, p.y, r, sides, rot, lineW,
      pickColor(palette, k, 0, s),
      w, h, s, cells,
    );
  });

  // Tier 2 — micro outlines (0.15× to 0.45× baseR), denser, with a
  // slightly thinner line so the hierarchy reads visually.
  const microLineW = Math.max(0.9, lineW * 0.7);
  const microCount = Math.floor(primaryCount * 1.6);
  const microSamples = samplePointsInPoly(
    outerPoly,
    microCount,
    s.seed + 9999,
  );
  microSamples.forEach((p, k) => {
    const sides = SIDES[Math.floor(hash(s.seed + 73 + k * 3.7) * SIDES.length)]!;
    const sizeRand = 0.15 + hash(s.seed + 113 + k * 5.1) * 0.3;
    const r = baseR * sizeRand;
    const rot = hash(s.seed + 211 + k * 7.3) * Math.PI * 2;
    outlineNgonAsEdges(
      p.x, p.y, r, sides, rot, microLineW,
      pickColor(palette, k + 100, 0, s),
      w, h, s, cells,
    );
  });

  return cells;
};

// ZIGZAG_SPIRAL — Partial-spiral sawtooth bands curving around the
// centre, alternating between two palette anchors. Each band is a
// closed strip whose outer edge is sawtoothed (triangular teeth
// pointing radially outward) and whose inner edge is smooth, so the
// band reads as a ceremonial / folk-printed zigzag. A second tier of
// vesica-shaped "leaf" ornaments is scattered around the perimeter.
const buildZigzagSpiral = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const cx = w / 2;
  const cy = h / 2;
  const maxR = (Math.min(w, h) / 2) * 0.94 * s.shapeScale;

  // Two palette anchors. Scan for genuinely distinct colours.
  const colA = palette[0]!;
  let colB = colA;
  for (let i = 1; i < palette.length; i++) {
    if (palette[i] !== colA) {
      colB = palette[i]!;
      break;
    }
  }

  const cells: GridCell[] = [];

  // ── SPIRAL ZIGZAG BANDS ───────────────────────────────────────────
  const arcCount = Math.max(4, Math.min(8, Math.floor(s.shapeDensity * 0.22)));
  const teethBase = Math.max(10, Math.floor(s.shapeDensity * 0.6));

  for (let arcIdx = 0; arcIdx < arcCount; arcIdx++) {
    const tNorm = arcIdx / Math.max(1, arcCount - 1);
    // Bands move outward as arcIdx grows — inner ones tight, outer wide.
    const baseR = maxR * (0.18 + tNorm * 0.72);
    // Arc spans ~0.6π–1.4π so several spirals can interlock.
    const arcSpan = Math.PI * (0.6 + hash(s.seed + arcIdx * 7.3) * 0.9);
    const startAngle = hash(s.seed + arcIdx * 13.7) * Math.PI * 2;
    // Light radial drift across the arc length so it reads as spiral.
    const spiralDrift = maxR * 0.06 * (hash(s.seed + arcIdx * 5.1) - 0.5);
    // Band thickness + tooth depth.
    const bandW = maxR * 0.04 * s.shapeScale;
    const toothH = bandW * (1.6 + hash(s.seed + arcIdx * 19.7) * 1.2);
    // Teeth count scales with arc length.
    const teeth = Math.max(6, Math.floor((teethBase * arcSpan) / (Math.PI * 2)));
    const samples = teeth * 2;

    const outerPts: V2[] = [];
    const innerPts: V2[] = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const a = startAngle + t * arcSpan;
      const r = baseR + t * spiralDrift;
      // Alternating sawtooth: even samples sit at the band's outer
      // surface + tooth height; odd samples drop back to the band's
      // outer surface only. The inner edge stays smooth.
      const tooth = i % 2 === 0 ? toothH : 0;
      const rOut = r + bandW / 2 + tooth;
      const rIn = r - bandW / 2;
      outerPts.push({ x: cx + Math.cos(a) * rOut, y: cy + Math.sin(a) * rOut });
      innerPts.push({ x: cx + Math.cos(a) * rIn, y: cy + Math.sin(a) * rIn });
    }

    const parts: string[] = [];
    outerPts.forEach((p, i) => {
      const wp = warpPoint(p.x, p.y, w, h, s);
      parts.push(`${i === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
    });
    for (let i = innerPts.length - 1; i >= 0; i--) {
      const p = innerPts[i]!;
      const wp = warpPoint(p.x, p.y, w, h, s);
      parts.push(`L ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
    }
    parts.push("Z");
    // Anchor cx/cy at the band's midpoint so the stagger reveals
    // bands roughly outward through the spiral.
    const ac = startAngle + arcSpan / 2;
    cells.push({
      d: parts.join(" "),
      color: arcIdx % 2 === 0 ? colA : colB,
      cx: cx + Math.cos(ac) * baseR,
      cy: cy + Math.sin(ac) * baseR,
    });
  }

  // ── VESICA / LEAF ORNAMENTS AROUND PERIMETER ──────────────────────
  const leafCount = Math.max(4, Math.floor(s.shapeDensity * 0.18));
  const leafW = maxR * 0.07 * s.shapeScale;
  const leafH = maxR * 0.17 * s.shapeScale;
  const N = 18;
  for (let i = 0; i < leafCount; i++) {
    const a =
      (i / leafCount) * Math.PI * 2 +
      hash(s.seed + i * 17.3) * 0.5;
    // Leaves sit just inside the rim.
    const lcx = cx + Math.cos(a) * maxR * 0.85;
    const lcy = cy + Math.sin(a) * maxR * 0.85;
    // Vesica: ellipse rotated to point radially.
    const rot = a + Math.PI / 2;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const pts: string[] = [];
    for (let k = 0; k <= N; k++) {
      const theta = (k / N) * Math.PI * 2;
      // Pinch the ellipse at the ends to give it a leaf/almond profile.
      const tipPinch = Math.pow(Math.abs(Math.cos(theta)), 1.4) * 0.4 + 0.6;
      const lx = Math.cos(theta) * leafH;
      const ly = Math.sin(theta) * leafW * tipPinch;
      const rx = lcx + cosR * lx - sinR * ly;
      const ry = lcy + sinR * lx + cosR * ly;
      const wp = warpPoint(rx, ry, w, h, s);
      pts.push(`${k === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
    }
    pts.push("Z");
    cells.push({
      d: pts.join(" "),
      color: i % 2 === 0 ? colB : colA,
      cx: lcx,
      cy: lcy,
    });
  }

  return cells;
};

// SPIRAL_FLOWER — Phyllotaxis-style flower. Each petal sits on a
// golden-angle spiral (~137.5°) from a central seed, with petal
// distance ∝ √i so the lattice mimics sunflower-seed packing. Petals
// orient radially outward and grow with distance, giving a clear
// flower silhouette. A small inner puck anchors the centre.
const buildSpiralFlower = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const cx = w / 2;
  const cy = h / 2;
  const maxR = (Math.min(w, h) / 2) * 0.92 * s.shapeScale;
  const petalCount = Math.max(24, Math.floor(s.shapeDensity * 1.5));
  // Golden angle in radians — produces the classic non-repeating
  // phyllotaxis pattern.
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const spread = maxR / Math.sqrt(petalCount) * 1.05;
  const basePetalLen = maxR * 0.16 * s.shapeScale;
  const basePetalWid = maxR * 0.055 * s.shapeScale;
  const N = 16;
  const cells: GridCell[] = [];

  for (let i = 0; i < petalCount; i++) {
    const angle = i * goldenAngle;
    const dist = Math.sqrt(i) * spread;
    if (dist > maxR) continue;
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;
    // Outer petals grow longer & wider, so the flower reads as
    // intentional rather than uniform dots.
    const growth = 0.55 + (dist / maxR) * 0.9;
    const localLen = basePetalLen * growth;
    const localWid = basePetalWid * growth;
    // Petal points radially outward.
    const cosR = Math.cos(angle);
    const sinR = Math.sin(angle);

    const pts: string[] = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const theta = t * Math.PI * 2;
      // Teardrop: pinches the +x tip so the petal has a clear point.
      const tipFactor =
        1 - 0.55 * Math.pow(Math.max(0, Math.cos(theta)), 2);
      const lx = Math.cos(theta) * localLen * tipFactor;
      const ly = Math.sin(theta) * localWid;
      // Rotate teardrop so its +x tip aligns with the radial direction.
      const rx = px + cosR * lx - sinR * ly;
      const ry = py + sinR * lx + cosR * ly;
      const wp = warpPoint(rx, ry, w, h, s);
      pts.push(`${k === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
    }
    pts.push("Z");
    cells.push({
      d: pts.join(" "),
      color: pickColor(palette, i, Math.floor(i / 8), s),
      cx: px,
      cy: py,
    });
  }

  // Central seed puck — small disc anchoring the spiral.
  const puckR = maxR * 0.06 * s.shapeScale;
  cells.push({
    d: ngonPath(cx, cy, puckR, 20, 0, w, h, s),
    color: palette[0]!,
    cx,
    cy,
  });

  return cells;
};

// SIGNAL_BURST — Horizontally-mirrored stepped waveform. Each row is
// split into N horizontal sub-segments whose colours cycle through
// the palette as we travel left-to-right, so the row reads as a
// rainbow gradient with chrome-reflection depth (highlights stepping
// across the band) rather than a flat colour bar.
const buildSignalBurst = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const cy = h / 2;
  const rowCount = Math.max(14, Math.floor(s.shapeDensity * 1.4));
  // Inscribed-square padding so the rectangular waveform fits inside
  // a circular boundary clip without the corners being chopped off.
  // For a circle of radius R, the inscribed square has side R·√2;
  // we go a touch tighter so there's visible margin.
  const inscFactor = 0.68 * s.shapeScale;
  const formH = h * inscFactor;
  const rowH = formH / 2 / rowCount;
  const inscWidth = w * inscFactor;
  const leftPoint = w / 2 - inscWidth / 2;
  const rightEdge = w / 2 + inscWidth / 2;
  const padding = Math.max(0.5, rowH * 0.1);
  const SEGMENTS = 5; // sub-segments per row → stepped depth
  const cells: GridCell[] = [];

  const pushRow = (leftEdge: number, widthRect: number, y: number, rectH: number, rowIdx: number) => {
    const segW = widthRect / SEGMENTS;
    for (let seg = 0; seg < SEGMENTS; seg++) {
      const x = leftEdge + seg * segW;
      const colorIdx = (rowIdx * 3 + seg) % palette.length;
      // Reveal left-to-right: cells with smaller x reveal first.
      const revealOrder = (x - leftPoint) / Math.max(1, rightEdge - leftPoint);
      cells.push({
        x,
        y,
        w: segW,
        h: rectH,
        color: palette[colorIdx]!,
        cx: x + segW / 2,
        cy: y + rectH / 2,
        revealOrder,
      });
    }
  };

  for (let r = 0; r < rowCount; r++) {
    const t = r / Math.max(1, rowCount - 1);
    // Linear profile — the left edge advances linearly so the
    // silhouette is a pure isoceles triangle (point on the left,
    // flush vertical edge on the right), mirrored top/bottom.
    const leftEdge = leftPoint + (rightEdge - leftPoint) * t * 0.92;
    const widthRect = rightEdge - leftEdge;
    if (widthRect < 2) continue;
    const rectH = Math.max(1, rowH - padding * 2);
    // Top + mirrored bottom rows.
    pushRow(leftEdge, widthRect, cy - (r + 1) * rowH + padding, rectH, r);
    pushRow(leftEdge, widthRect, cy + r * rowH + padding, rectH, r);
  }
  return cells;
};

// VORTEX_RINGS — Stack of concentric rings whose centres shift
// diagonally toward a vanishing point (creating the vortex flow).
// Each ring picks one of six graphic treatments by index so the
// stack reads as a layered sequencer: dotted strokes, striped
// bands, segmented arcs, checker tiles, neon outline, and rotated
// blocks. Rings overlap heavily, palette cycles per ring.
const buildVortexRings = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const cx = w / 2;
  const cy = h / 2;
  const maxR = (Math.min(w, h) / 2) * 0.95 * s.shapeScale;
  const ringCount = Math.max(6, Math.floor(s.shapeDensity * 0.45));
  // Vortex retired: every ring now shares the same canvas centre, so
  // the rings read as concentric instead of cascading toward an
  // off-centre vanishing point. Radius still tapers per ring, but the
  // centres are aligned to each other.
  const cells: GridCell[] = [];

  for (let ring = 0; ring < ringCount; ring++) {
    const t = ring / Math.max(1, ringCount - 1);
    const rcx = cx;
    const rcy = cy;
    // Radius shrinks toward the centre.
    const rR = maxR * (0.96 - t * 0.85);
    if (rR < 6) continue;
    const treatment = ring % 6;
    const color = palette[ring % palette.length]!;
    const rotation = t * Math.PI * 2; // per-ring rotation drift

    if (treatment === 0) {
      // DOTTED — small circles around the perimeter.
      const dots = Math.max(12, Math.floor(40 - ring * 2));
      const dotR = Math.max(2, rR * 0.045);
      for (let i = 0; i < dots; i++) {
        const a = (i / dots) * Math.PI * 2 + rotation;
        const dx = rcx + Math.cos(a) * rR;
        const dy = rcy + Math.sin(a) * rR;
        cells.push({
          d: ellipsePath(dx, dy, dotR, dotR, 0, w, h, s, 12),
          color,
          cx: dx,
          cy: dy,
        });
      }
    } else if (treatment === 1) {
      // STRIPED — alternating filled wedge bands.
      const stripes = 14;
      const innerR = rR * 0.86;
      const outerR = rR;
      for (let i = 0; i < stripes; i++) {
        if (i % 2 === 0) continue;
        const a1 = (i / stripes) * Math.PI * 2 + rotation;
        const a2 = ((i + 1) / stripes) * Math.PI * 2 + rotation;
        const ac = (a1 + a2) / 2;
        const rc = (innerR + outerR) / 2;
        cells.push({
          d: polarCellPath(rcx, rcy, innerR, outerR, a1, a2, w, h, s),
          color,
          cx: rcx + Math.cos(ac) * rc,
          cy: rcy + Math.sin(ac) * rc,
        });
      }
    } else if (treatment === 2) {
      // SEGMENTED ARCS — three thick arcs around the ring.
      const arcs = 3;
      const arcW = Math.max(2, rR * 0.04);
      for (let i = 0; i < arcs; i++) {
        const a1 = (i / arcs) * Math.PI * 2 + rotation;
        const a2 = a1 + Math.PI * 0.42;
        cells.push({
          d: polarCellPath(rcx, rcy, rR - arcW, rR + arcW, a1, a2, w, h, s),
          color,
          cx: rcx + Math.cos((a1 + a2) / 2) * rR,
          cy: rcy + Math.sin((a1 + a2) / 2) * rR,
        });
      }
    } else if (treatment === 3) {
      // CHECKER — alternating wedge tiles forming a polar checker.
      const wedges = 18;
      const innerR = rR * 0.78;
      const outerR = rR;
      for (let i = 0; i < wedges; i++) {
        if (i % 2 === 0) continue;
        const a1 = (i / wedges) * Math.PI * 2 + rotation;
        const a2 = ((i + 1) / wedges) * Math.PI * 2 + rotation;
        const ac = (a1 + a2) / 2;
        cells.push({
          d: polarCellPath(rcx, rcy, innerR, outerR, a1, a2, w, h, s),
          color,
          cx: rcx + Math.cos(ac) * (innerR + outerR) / 2,
          cy: rcy + Math.sin(ac) * (innerR + outerR) / 2,
        });
      }
    } else if (treatment === 4) {
      // NEON OUTLINE — thin annulus stroked around the full ring.
      const lineW = Math.max(1.5, 2.8 * s.shapeScale);
      cells.push({
        d: polarCellPath(rcx, rcy, rR - lineW, rR + lineW, 0, Math.PI * 2, w, h, s),
        color,
        cx: rcx,
        cy: rcy,
      });
    } else {
      // BLOCKS — rotated rectangles around the perimeter, tangent
      // to the ring.
      const blocks = Math.max(8, Math.floor(20 - ring));
      const blockW = rR * 0.13;
      const blockH = rR * 0.055;
      for (let i = 0; i < blocks; i++) {
        const a = (i / blocks) * Math.PI * 2 + rotation;
        const bx = rcx + Math.cos(a) * rR;
        const by = rcy + Math.sin(a) * rR;
        const rot = a + Math.PI / 2;
        const cosR = Math.cos(rot);
        const sinR = Math.sin(rot);
        const corners: V2[] = [
          { x: -blockW / 2, y: -blockH / 2 },
          { x: blockW / 2, y: -blockH / 2 },
          { x: blockW / 2, y: blockH / 2 },
          { x: -blockW / 2, y: blockH / 2 },
        ];
        const parts: string[] = [];
        corners.forEach((c, k) => {
          const px = bx + cosR * c.x - sinR * c.y;
          const py = by + sinR * c.x + cosR * c.y;
          const wp = warpPoint(px, py, w, h, s);
          parts.push(`${k === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
        });
        parts.push("Z");
        cells.push({
          d: parts.join(" "),
          color,
          cx: bx,
          cy: by,
        });
      }
    }
  }
  return cells;
};

// RIBBON_TEARDROP — Teardrop silhouette sliced into vertical ribbon
// strips, each strip further sliced into vertical sub-segments so
// palette colours step along the strip's height. The stepped colour
// reads as chrome-reflection depth (light catching different parts
// of a curved 3D surface) rather than flat ribbons.
const buildRibbonTeardrop = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const cx = w / 2;
  const cy = h / 2;
  const tearW = w * 0.55 * s.shapeScale;
  const tearH = h * 0.85 * s.shapeScale;
  // Symmetric profile — both ends taper (top point + bottom ellipse
  // curve) so the silhouette reads as an elongated egg / pod with
  // rounded ends, not a flat-bottomed teardrop.
  const halfWidthAt = (yNorm: number): number => {
    if (yNorm < 0 || yNorm > 1) return 0;
    return Math.sin(yNorm * Math.PI);
  };
  const stripCount = Math.max(8, Math.floor(s.shapeDensity * 0.55));
  const segmentsPerStrip = 4; // vertical sub-segments → depth steps
  const samples = 6; // samples along each sub-segment's height
  const gapFrac = 0.22;
  const fillFrac = 1 - gapFrac;
  const cells: GridCell[] = [];

  for (let i = 0; i < stripCount; i++) {
    const t0 = i / stripCount;
    const t1 = (i + fillFrac) / stripCount;
    // Each strip splits vertically into `segmentsPerStrip` slices.
    for (let seg = 0; seg < segmentsPerStrip; seg++) {
      const yStart = seg / segmentsPerStrip;
      const yEnd = (seg + 1) / segmentsPerStrip;
      const leftPts: V2[] = [];
      const rightPts: V2[] = [];
      for (let k = 0; k <= samples; k++) {
        const yNorm = yStart + (yEnd - yStart) * (k / samples);
        const halfW = halfWidthAt(yNorm) * tearW * 0.5;
        const twist =
          Math.sin(yNorm * Math.PI) * tearW * 0.04 *
          ((i / stripCount - 0.5) * 2);
        const yAbs = cy - tearH / 2 + yNorm * tearH;
        const xL = cx + twist + (-halfW + 2 * halfW * t0);
        const xR = cx + twist + (-halfW + 2 * halfW * t1);
        leftPts.push({ x: xL, y: yAbs });
        rightPts.push({ x: xR, y: yAbs });
      }
      const parts: string[] = [];
      leftPts.forEach((p, k) => {
        const wp = warpPoint(p.x, p.y, w, h, s);
        parts.push(`${k === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
      });
      for (let k = rightPts.length - 1; k >= 0; k--) {
        const p = rightPts[k]!;
        const wp = warpPoint(p.x, p.y, w, h, s);
        parts.push(`L ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
      }
      parts.push("Z");
      // Colour cycles per segment with a strip-dependent offset so
      // adjacent strips offset their phase — the chrome / holographic
      // depth read.
      const colorIdx = (i * 2 + seg) % palette.length;
      // Anchor cy at this segment's centre so the per-cell stagger
      // reveals strip segments top-to-bottom in waves.
      const segCenterY =
        cy - tearH / 2 + ((yStart + yEnd) / 2) * tearH;
      // Reveal top-to-bottom — earlier segments (low yStart) appear first.
      const revealOrder = (yStart + yEnd) / 2;
      cells.push({
        d: parts.join(" "),
        color: palette[colorIdx]!,
        cx,
        cy: segCenterY,
        revealOrder,
      });
    }
  }
  return cells;
};

// HALFTONE_BLOB — Cartesian dot grid where each dot's radius is
// driven by a smooth multi-frequency sine field. Darker regions
// (high field value) bloom into large circles, lighter regions fade
// to tiny dots, giving airbrushed-cloud volumes through pure
// dot-size variation.
const buildHalftoneBlob = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const density = Math.max(18, Math.floor(s.shapeDensity * 1.0));
  const stepX = w / density;
  const stepY = h / density;
  const maxDotR = Math.min(stepX, stepY) * 0.55 * s.shapeScale;
  const seedShift = s.seed * 0.013;
  // Multi-frequency density field. Output in roughly [-1, 1].
  const fieldAt = (x: number, y: number): number => {
    const u = x / w;
    const v = y / h;
    return (
      Math.sin(u * Math.PI * 2 + seedShift) +
      Math.sin(v * Math.PI * 2 + seedShift * 1.7) +
      Math.sin((u + v) * Math.PI * 2.5 + seedShift * 0.7) +
      Math.sin((u - v) * Math.PI * 3.1 + seedShift * 2.1) * 0.5
    ) / 3.5;
  };

  const cells: GridCell[] = [];
  for (let iy = 0; iy < density; iy++) {
    for (let ix = 0; ix < density; ix++) {
      const cellCX = ix * stepX + stepX / 2;
      const cellCY = iy * stepY + stepY / 2;
      const f = fieldAt(cellCX, cellCY);
      const intensity = Math.max(0, Math.min(1, (f + 1) / 2));
      // Skip dots in very low-intensity areas so the blob silhouette
      // has clean negative space.
      if (intensity < 0.15) continue;
      const dotR = maxDotR * intensity;
      // Colour stepping by intensity — bright regions pull palette[0],
      // dark regions reach the far end. Gives a monochrome-print depth.
      const colorIdx = Math.min(
        palette.length - 1,
        Math.floor(intensity * palette.length),
      );
      cells.push({
        d: ellipsePath(cellCX, cellCY, dotR, dotR, 0, w, h, s, 12),
        color: palette[colorIdx]!,
        cx: cellCX,
        cy: cellCY,
        // Densest (highest intensity) dots reveal first; lighter
        // dots trail in — reads as the cloud blooming into focus.
        revealOrder: 1 - intensity,
      });
    }
  }
  return cells;
};

// INK_SPLATTER — Chaotic liquid-impact composition built from four
// tiers: (1) a central irregular blob whose perimeter is wobbled by
// multi-harmonic noise, (2) tapered radial streaks simulating
// directional momentum, (3) secondary droplets scattered around the
// blob with their own irregular outlines, and (4) tiny spray dots
// for noise texture. Asymmetric distribution + uneven edges read as
// liquid physics frozen at impact.
const buildInkSplatter = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const cx = w / 2;
  const cy = h / 2;
  const maxR = (Math.min(w, h) / 2) * 0.95 * s.shapeScale;
  const cells: GridCell[] = [];
  const blobR = maxR * 0.22;
  const seedPhase = s.seed * 0.7;

  // ── 1. CENTRAL BLOB — irregular closed outline ───────────────────
  {
    const N = 36;
    const pts: string[] = [];
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * Math.PI * 2;
      const wob =
        Math.sin(a * 3 + seedPhase) * 0.20 +
        Math.sin(a * 5 + seedPhase * 1.3) * 0.12 +
        Math.sin(a * 11 + seedPhase * 1.9) * 0.06;
      const r = blobR * (1 + wob);
      const wp = warpPoint(cx + Math.cos(a) * r, cy + Math.sin(a) * r, w, h, s);
      pts.push(`${k === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
    }
    pts.push("Z");
    cells.push({
      d: pts.join(" "),
      color: palette[0]!,
      cx,
      cy,
    });
  }

  // ── 2. TAPERED STREAKS — radial momentum strokes ─────────────────
  const streakCount = Math.max(4, Math.floor(s.shapeDensity * 0.2));
  for (let i = 0; i < streakCount; i++) {
    const a = hash(s.seed + i * 13.7) * Math.PI * 2;
    const startR = blobR * (0.85 + hash(s.seed + i * 5.1) * 0.35);
    const length = maxR * (0.4 + hash(s.seed + i * 7.3) * 0.5);
    const endR = Math.min(maxR, startR + length);
    const widthStart = blobR * (0.16 + hash(s.seed + i * 11.1) * 0.3);
    const widthEnd = blobR * 0.04;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    const perpX = -sinA;
    const perpY = cosA;
    const corners: V2[] = [
      { x: cx + cosA * startR + perpX * widthStart / 2, y: cy + sinA * startR + perpY * widthStart / 2 },
      { x: cx + cosA * endR + perpX * widthEnd / 2, y: cy + sinA * endR + perpY * widthEnd / 2 },
      { x: cx + cosA * endR - perpX * widthEnd / 2, y: cy + sinA * endR - perpY * widthEnd / 2 },
      { x: cx + cosA * startR - perpX * widthStart / 2, y: cy + sinA * startR - perpY * widthStart / 2 },
    ];
    const parts: string[] = [];
    corners.forEach((c, k) => {
      const wp = warpPoint(c.x, c.y, w, h, s);
      parts.push(`${k === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
    });
    parts.push("Z");
    const midR = (startR + endR) / 2;
    cells.push({
      d: parts.join(" "),
      color: palette[0]!,
      cx: cx + cosA * midR,
      cy: cy + sinA * midR,
    });
  }

  // ── 3. DROPLETS — irregular satellite blobs ──────────────────────
  const dropCount = Math.max(8, Math.floor(s.shapeDensity * 0.5));
  for (let i = 0; i < dropCount; i++) {
    const a = hash(s.seed + 100 + i * 17.3) * Math.PI * 2;
    const r = (0.3 + hash(s.seed + i * 9.7) * 0.65) * maxR;
    const dx = cx + Math.cos(a) * r;
    const dy = cy + Math.sin(a) * r;
    const dropR = blobR * (0.07 + hash(s.seed + i * 5.1) * 0.2);
    const N = 14;
    const pts: string[] = [];
    for (let k = 0; k <= N; k++) {
      const ta = (k / N) * Math.PI * 2;
      const wob =
        Math.sin(ta * 3 + i + seedPhase) * 0.28 +
        Math.sin(ta * 5 + i * 1.7) * 0.14;
      const lr = dropR * (1 + wob);
      const wp = warpPoint(dx + Math.cos(ta) * lr, dy + Math.sin(ta) * lr, w, h, s);
      pts.push(`${k === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
    }
    pts.push("Z");
    cells.push({
      d: pts.join(" "),
      color: palette[0]!,
      cx: dx,
      cy: dy,
    });
  }

  // ── 4. SPRAY NOISE — tiny dots scattered widely ──────────────────
  const sprayCount = Math.max(30, Math.floor(s.shapeDensity * 1.6));
  for (let i = 0; i < sprayCount; i++) {
    const a = hash(s.seed + 200 + i * 23.7) * Math.PI * 2;
    const r = (0.35 + hash(s.seed + i * 13.1) * 0.6) * maxR;
    const dx = cx + Math.cos(a) * r;
    const dy = cy + Math.sin(a) * r;
    const dotR = blobR * (0.015 + hash(s.seed + i * 7.7) * 0.05);
    cells.push({
      d: ellipsePath(dx, dy, dotR, dotR, 0, w, h, s, 8),
      color: palette[0]!,
      cx: dx,
      cy: dy,
    });
  }

  return cells;
};

// CHROMATIC_DITHER — Dense pixel grid driven by a diagonal sine
// flow field. Each cell picks a palette colour by (ix + iy×2)
// channel-index so adjacent cells use different palette anchors,
// and each cell is offset by its channel index to simulate CMYK
// print misregistration. Cell size scales with field intensity so
// the flow reads as a wavy raster.
const buildChromaticDither = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const density = Math.max(18, Math.floor(s.shapeDensity * 1.1));
  const stepX = w / density;
  const stepY = h / density;
  const cellW0 = stepX * 0.85 * s.shapeScale;
  const cellH0 = stepY * 0.85 * s.shapeScale;
  const seedShift = s.seed * 0.013;
  const fieldAt = (x: number, y: number): number => {
    const u = x / w;
    const v = y / h;
    return (
      Math.sin((u + v) * Math.PI * 3 + seedShift) +
      Math.sin((u - v) * Math.PI * 2 + seedShift * 1.7) * 0.6 +
      Math.sin(u * Math.PI * 4 + seedShift * 0.5) * 0.3 +
      Math.sin(v * Math.PI * 3.5 + seedShift * 2.1) * 0.3
    ) / 2.2;
  };
  const cells: GridCell[] = [];
  for (let iy = 0; iy < density; iy++) {
    for (let ix = 0; ix < density; ix++) {
      const cellCX = ix * stepX + stepX / 2;
      const cellCY = iy * stepY + stepY / 2;
      const f = fieldAt(cellCX, cellCY);
      const intensity = Math.max(0, Math.min(1, (f + 1) / 2));
      if (intensity < 0.18) continue;
      const channel = (ix + iy * 2) % palette.length;
      const color = palette[channel]!;
      const scl = 0.5 + intensity * 0.85;
      const w_ = cellW0 * scl;
      const h_ = cellH0 * scl;
      // CMYK-misregistration offset by channel.
      const offsetX = (channel - palette.length / 2) * 1.2;
      const offsetY = (channel - palette.length / 2) * 0.8;
      cells.push({
        x: cellCX - w_ / 2 + offsetX,
        y: cellCY - h_ / 2 + offsetY,
        w: w_,
        h: h_,
        color,
        cx: cellCX,
        cy: cellCY,
        // Densest cells reveal first — the wave flows through the
        // grid as the eruption settles.
        revealOrder: 1 - intensity,
      });
    }
  }
  return cells;
};

// VECTOR_JUNCTIONS — Repeated minimal junctions on a jittered grid.
// Each junction has 3–5 thick tapered arms meeting at a small
// central dot, like a network-diagram / subway-map node. The arms
// taper from a wide root at the junction to a thinner tip so they
// read as "merged" lines rather than rigid rectangles.
const buildVectorJunctions = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const junctionCount = Math.max(4, Math.floor(s.shapeDensity * 0.25));
  const gridSize = Math.max(2, Math.ceil(Math.sqrt(junctionCount)));
  const cellWi = w / gridSize;
  const cellHi = h / gridSize;
  const cells: GridCell[] = [];

  for (let i = 0; i < junctionCount; i++) {
    const ix = i % gridSize;
    const iy = Math.floor(i / gridSize);
    const baseX = (ix + 0.5) * cellWi;
    const baseY = (iy + 0.5) * cellHi;
    const jx = (hash(s.seed + i * 3.7) - 0.5) * cellWi * 0.35;
    const jy = (hash(s.seed + i * 11.13) - 0.5) * cellHi * 0.35;
    const jcx = baseX + jx;
    const jcy = baseY + jy;
    const armCount = 3 + Math.floor(hash(s.seed + i * 5.1) * 3);
    const baseLength = Math.min(cellWi, cellHi) * 0.42 * s.shapeScale;
    const lineW = baseLength * 0.2;
    const tipW = lineW * 0.32;

    for (let k = 0; k < armCount; k++) {
      const angle =
        (k / armCount) * Math.PI * 2 +
        hash(s.seed + i * 13.7 + k * 7.3) * 0.5;
      const length =
        baseLength * (0.7 + hash(s.seed + i * 17.1 + k * 5.3) * 0.4);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const perpX = -sinA;
      const perpY = cosA;
      // Slight inset at the junction so arms don't overlap the
      // central dot abruptly.
      const innerR = lineW * 0.1;
      const innerX = jcx + cosA * innerR;
      const innerY = jcy + sinA * innerR;
      const tipX = jcx + cosA * length;
      const tipY = jcy + sinA * length;
      cells.push(
        quadCell(
          { x: innerX + perpX * lineW / 2, y: innerY + perpY * lineW / 2 },
          { x: tipX + perpX * tipW / 2, y: tipY + perpY * tipW / 2 },
          { x: tipX - perpX * tipW / 2, y: tipY - perpY * tipW / 2 },
          { x: innerX - perpX * lineW / 2, y: innerY - perpY * lineW / 2 },
          w,
          h,
          s,
          pickColor(palette, i + k, k, s),
        ),
      );
    }

    // Central node — soft dot where the arms merge.
    const dotR = lineW * 0.7;
    cells.push({
      d: ellipsePath(jcx, jcy, dotR, dotR, 0, w, h, s, 14),
      color: pickColor(palette, i * 7, 0, s),
      cx: jcx,
      cy: jcy,
    });
  }
  return cells;
};

// PINWHEEL_TILT — Radial spokes around a central elliptical hole,
// vertically squashed so the whole disc reads as tilted on its
// horizontal axis. Each spoke is a thin tapered quad coloured from
// a per-index palette pick. Asymmetry drives the tilt strength
// (more asymmetry → flatter squash → stronger 3-D illusion).
const buildPinwheelTilt = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const cx = w / 2;
  const cy = h / 2;
  const maxR = (Math.min(w, h) / 2) * 0.94 * s.shapeScale;
  const outerR = maxR;
  const innerR = maxR * 0.32;
  const spokeCount = Math.max(24, Math.floor(s.shapeDensity * 1.2));
  // Tilt strength: 0 asymmetry → 0.95 (nearly flat); 100 asymmetry
  // → 0.45 (heavy tilt). Clamped so the disc never collapses to a
  // line.
  const squashY = Math.max(0.4, 0.95 - (s.asymmetry / 100) * 0.5);
  // Each spoke covers ~half its angular slot — visible gap between
  // adjacent spokes preserves the pinwheel read.
  const fillFrac = 0.5;
  const halfAngle = (Math.PI / spokeCount) * fillFrac;
  const cells: GridCell[] = [];

  for (let i = 0; i < spokeCount; i++) {
    const a = (i / spokeCount) * Math.PI * 2 - Math.PI / 2;
    const aL = a - halfAngle;
    const aR = a + halfAngle;
    const corners: V2[] = [
      { x: cx + Math.cos(aL) * innerR, y: cy + Math.sin(aL) * innerR * squashY },
      { x: cx + Math.cos(aL) * outerR, y: cy + Math.sin(aL) * outerR * squashY },
      { x: cx + Math.cos(aR) * outerR, y: cy + Math.sin(aR) * outerR * squashY },
      { x: cx + Math.cos(aR) * innerR, y: cy + Math.sin(aR) * innerR * squashY },
    ];
    const parts: string[] = [];
    corners.forEach((p, k) => {
      const wp = warpPoint(p.x, p.y, w, h, s);
      parts.push(`${k === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
    });
    parts.push("Z");

    // Spokes near the horizontal silhouette (top/bottom of the
    // tilted disc) get a thin shadow stripe alongside, simulating
    // the visible "edge" of the 3-D plane.
    const tiltVisibility = Math.abs(Math.sin(a));
    if (tiltVisibility > 0.55 && squashY < 0.85) {
      // Project the spoke slightly toward camera (offset y by a
      // small amount based on which side of the disc it's on).
      const dir = Math.sin(a) > 0 ? 1 : -1;
      const offsetY = (tiltVisibility - 0.55) * 8 * (1 - squashY) * dir;
      const shadowCorners: V2[] = corners.map((c) => ({
        x: c.x,
        y: c.y + offsetY,
      }));
      const sParts: string[] = [];
      shadowCorners.forEach((p, k) => {
        const wp = warpPoint(p.x, p.y, w, h, s);
        sParts.push(`${k === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
      });
      sParts.push("Z");
      cells.push({
        d: sParts.join(" "),
        color: "rgba(10,10,10,0.45)",
        cx: cx + Math.cos(a) * (innerR + outerR) / 2,
        cy: cy + Math.sin(a) * (innerR + outerR) / 2 * squashY + offsetY,
        revealOrder: i / spokeCount,
      });
    }

    // Front face of the spoke.
    const cxMid = cx + Math.cos(a) * (innerR + outerR) / 2;
    const cyMid = cy + Math.sin(a) * (innerR + outerR) / 2 * squashY;
    cells.push({
      d: parts.join(" "),
      color: palette[i % palette.length]!,
      cx: cxMid,
      cy: cyMid,
      // Reveal clockwise around the ring.
      revealOrder: i / spokeCount,
    });
  }
  return cells;
};

// CONCENTRIC_SPOKES — Three concentric rings of radial tapered
// wedge-spokes (28 inner / 36 mid / 48 outer) around a small central
// dot. Each ring's spokes are trapezoids — narrow at the inner edge,
// wider at the outer edge — so the field reads as an op-art dial /
// instrument face. Each ring has a slight rotation offset and its
// own reveal-window so the rings spin into place outward.
const buildConcentricSpokes = (
  w: number,
  h: number,
  palette: string[],
  s: CellGridSettings,
): GridCell[] => {
  const cx = w / 2;
  const cy = h / 2;
  const maxR = (Math.min(w, h) / 2) * 0.94 * s.shapeScale;
  // Ring radius boundaries.
  const r0 = maxR * 0.06; // centre dot
  const r1 = maxR * 0.22;
  const r2 = maxR * 0.44;
  const r3 = maxR * 0.96;
  const cells: GridCell[] = [];

  // Centre dot — reveals first.
  cells.push({
    d: ellipsePath(cx, cy, r0, r0, 0, w, h, s, 18),
    color: palette[0]!,
    cx,
    cy,
    revealOrder: 0,
  });

  // Ring definitions — spoke count, radius range, taper, rotation
  // offset, and reveal-window range.
  type RingDef = {
    spokes: number;
    inR: number;
    outR: number;
    taperOut: number;
    rot: number;
    revealStart: number;
    revealEnd: number;
  };
  const rings: RingDef[] = [
    {
      spokes: 28,
      inR: r0 * 1.5,
      outR: r1,
      taperOut: 0.9,
      rot: 0,
      revealStart: 0.05,
      revealEnd: 0.3,
    },
    {
      spokes: 36,
      inR: r1 * 1.06,
      outR: r2,
      taperOut: 1.1,
      rot: Math.PI / 36, // half-slot offset relative to outer
      revealStart: 0.35,
      revealEnd: 0.6,
    },
    {
      spokes: 48,
      inR: r2 * 1.04,
      outR: r3,
      taperOut: 1.45,
      rot: 0,
      revealStart: 0.65,
      revealEnd: 0.95,
    },
  ];

  rings.forEach((ring, ringIdx) => {
    for (let i = 0; i < ring.spokes; i++) {
      const a = (i / ring.spokes) * Math.PI * 2 - Math.PI / 2 + ring.rot;
      const slotHalf = Math.PI / ring.spokes;
      const halfIn = slotHalf * 0.2;
      const halfOut = slotHalf * 0.45 * ring.taperOut;
      const aLin = a - halfIn;
      const aRin = a + halfIn;
      const aLout = a - halfOut;
      const aRout = a + halfOut;
      const corners: V2[] = [
        { x: cx + Math.cos(aLin) * ring.inR, y: cy + Math.sin(aLin) * ring.inR },
        { x: cx + Math.cos(aLout) * ring.outR, y: cy + Math.sin(aLout) * ring.outR },
        { x: cx + Math.cos(aRout) * ring.outR, y: cy + Math.sin(aRout) * ring.outR },
        { x: cx + Math.cos(aRin) * ring.inR, y: cy + Math.sin(aRin) * ring.inR },
      ];
      const parts: string[] = [];
      corners.forEach((p, k) => {
        const wp = warpPoint(p.x, p.y, w, h, s);
        parts.push(`${k === 0 ? "M" : "L"} ${wp.x.toFixed(2)} ${wp.y.toFixed(2)}`);
      });
      parts.push("Z");
      const t = i / ring.spokes;
      const midR = (ring.inR + ring.outR) / 2;
      cells.push({
        d: parts.join(" "),
        color: palette[(i + ringIdx * 7) % palette.length]!,
        cx: cx + Math.cos(a) * midR,
        cy: cy + Math.sin(a) * midR,
        // Sweep clockwise within this ring's reveal window so each
        // ring spins into place outward.
        revealOrder:
          ring.revealStart + t * (ring.revealEnd - ring.revealStart),
      });
    }
  });

  return cells;
};

// ── Dispatcher ──────────────────────────────────────────────────────────

export const buildCellGrid = (
  type: CellGridType,
  settings: CellGridSettings,
  w: number,
  h: number,
  palette: string[],
): GridCell[] => {
  switch (type) {
    case "blocks":
      return buildBlocks(w, h, palette, settings);
    case "wedges":
      return buildWedges(w, h, palette, settings);
    case "arcs":
      return buildArcs(w, h, palette, settings);
    case "checker_fields":
      return buildCheckerFields(w, h, palette, settings);
    case "warped_bands":
      return buildWarpedBands(w, h, palette, settings);
    case "radial_segments":
      return buildRadialSegments(w, h, palette, settings);
    case "radial_burst":
      return buildRadialBurst(w, h, palette, settings);
    case "kinetic_shockwave":
      return buildKineticShockwave(w, h, palette, settings);
    case "fragmented_ray":
      return buildFragmentedRay(w, h, palette, settings);
    case "mixed":
      return buildMixed(w, h, palette, settings);
    case "plotter_lines":
      return buildPlotterLines(w, h, palette, settings);
    case "particle_burst":
      return buildParticleBurst(w, h, palette, settings);
    case "ink_spiral":
      return buildInkSpiral(w, h, palette, settings);
    case "squishy_blobs":
      return buildSquishyBlobs(w, h, palette, settings);
    case "radial_checker":
      return buildRadialChecker(w, h, palette, settings);
    case "optical_dial":
      return buildOpticalDial(w, h, palette, settings);
    case "pixel_topography":
      return buildPixelTopography(w, h, palette, settings);
    case "poster_stack":
      return buildPosterStack(w, h, palette, settings);
    case "interference_mandala":
      return buildInterferenceMandala(w, h, palette, settings);
    case "crescent_grid":
      return buildCrescentGrid(w, h, palette, settings);
    case "sine_stripes":
      return buildSineStripes(w, h, palette, settings);
    case "triangle_grid":
      return buildTriangleGrid(w, h, palette, settings);
    case "hexagon_grid":
      return buildHexagonGrid(w, h, palette, settings);
    case "ellipse_field":
      return buildEllipseField(w, h, palette, settings);
    case "primitive_soup":
      return buildPrimitiveSoup(w, h, palette, settings);
    case "polygon_mix":
      return buildPolygonMix(w, h, palette, settings);
    case "voronoi_cells":
      return buildVoronoiCells(w, h, palette, settings);
    case "delaunay_mesh":
      return buildDelaunayMesh(w, h, palette, settings);
    case "mesh_gradient":
      return buildMeshGradient(w, h, palette, settings);
    case "topographic_lines":
      return buildTopographicLines(w, h, palette, settings);
    case "polygon_composite":
      return buildPolygonComposite(w, h, palette, settings);
    case "zigzag_spiral":
      return buildZigzagSpiral(w, h, palette, settings);
    case "spiral_flower":
      return buildSpiralFlower(w, h, palette, settings);
    case "signal_burst":
      return buildSignalBurst(w, h, palette, settings);
    case "vortex_rings":
      return buildVortexRings(w, h, palette, settings);
    case "ribbon_teardrop":
      return buildRibbonTeardrop(w, h, palette, settings);
    case "halftone_blob":
      return buildHalftoneBlob(w, h, palette, settings);
    case "ink_splatter":
      return buildInkSplatter(w, h, palette, settings);
    case "chromatic_dither":
      return buildChromaticDither(w, h, palette, settings);
    case "vector_junctions":
      return buildVectorJunctions(w, h, palette, settings);
    case "pinwheel_tilt":
      return buildPinwheelTilt(w, h, palette, settings);
    case "concentric_spokes":
      return buildConcentricSpokes(w, h, palette, settings);
  }
};
