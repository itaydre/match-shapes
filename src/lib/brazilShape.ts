// Procedural goal-shape geometries. Builders exported:
//   - buildEnglandShards         (1st England goal — chaotic shards)
//   - buildEnglandSunburst       (2nd England goal — radial checkerboard)
//   - buildEnglandSlantStripes   (3rd England goal — slanted parallelograms)
//   - buildBrazilStraightStripes (1st Brazil goal — horizon stripes)
//   - buildBrazilSawtoothGrid    (2nd Brazil goal — right-triangle grid)

// Slanted parallelogram stripes — N wide bars leaning right-to-left,
// evenly spaced across the zone. Matches the reference of 4 thick
// diagonal stripes tilted slightly. Used for England's 3rd goal.
export const buildEnglandSlantStripes = (w: number, h: number): string => {
  // More bars, but the whole pattern shrinks to ~65% of the zone and
  // sits centred — so it reads as a denser cluster rather than full-
  // width stripes.
  const N = 7;
  const scale = 0.65;
  const innerW = w * scale;
  const innerH = h * scale;
  // Anchored to the top-right of the zone.
  const xOff = w - innerW;
  const yOff = 0;
  const gap = innerW / (N * 6);
  const colW = (innerW - gap * (N - 1)) / N;
  const skew = innerH * 0.32;
  let d = "";
  for (let i = 0; i < N; i++) {
    const xTopL = xOff + i * (colW + gap) + skew;
    const xTopR = xTopL + colW;
    const xBotL = xTopL - skew;
    const xBotR = xTopR - skew;
    const yT = yOff;
    const yB = yOff + innerH;
    d += `M ${xTopL.toFixed(1)} ${yT.toFixed(1)} L ${xTopR.toFixed(1)} ${yT.toFixed(1)} L ${xBotR.toFixed(1)} ${yB.toFixed(1)} L ${xBotL.toFixed(1)} ${yB.toFixed(1)} Z `;
  }
  return d.trim();
};

// Smooth organic blob — irregular polygon smoothed via quadratic
// beziers between midpoints. Used as an ABSTRACT MASK to clip larger
// patterns (e.g. the enlarged Brazil 2nd goal triangles), so only a
// blob-shaped fragment of the pattern shows through.
export const buildAbstractBlob = (w: number, h: number): string => {
  const cx = w / 2;
  const cy = h / 2;
  const baseR = Math.min(w, h) * 0.46;
  const N = 14;
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2;
    const r1 = (Math.sin(i * 12.9898) + 1) / 2;
    const r2 = (Math.sin(i * 78.233) + 1) / 2;
    const r3 = (Math.sin(i * 39.41) + 1) / 2;
    const radius = baseR * (0.55 + r1 * 0.75);
    const radialOffsetX = (r2 - 0.5) * baseR * 0.4;
    const radialOffsetY = (r3 - 0.5) * baseR * 0.4;
    pts.push([
      cx + Math.cos(angle) * radius + radialOffsetX,
      cy + Math.sin(angle) * radius + radialOffsetY,
    ]);
  }
  let d = "";
  for (let i = 0; i < N; i++) {
    const p0 = pts[i]!;
    const p1 = pts[(i + 1) % N]!;
    const mx = (p0[0] + p1[0]) / 2;
    const my = (p0[1] + p1[1]) / 2;
    if (i === 0) {
      d += `M ${mx.toFixed(1)} ${my.toFixed(1)} `;
    } else {
      d += `Q ${p0[0].toFixed(1)} ${p0[1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)} `;
    }
  }
  d += "Z";
  return d.trim();
};

// Radial checkerboard sunburst — 24 wedges × 6 rings, alternately
// filled in a radial checkerboard so the rays look segmented into
// blocks like the reference. Used for England's second goal.
export const buildEnglandSunburst = (w: number, h: number): string => {
  // Sparse — fewer rays and rings so the radial layout still reads but
  // there's more white space between filled blocks.
  const N_RAYS = 16;
  const N_RINGS = 4;
  const cx = w / 2;
  const cy = h / 2;
  // Smaller — sits clearly inside the zone instead of bleeding to the
  // edges. ~35% of the diagonal, leaving margin around it.
  const maxR = Math.hypot(w, h) * 0.35;
  let d = "";
  for (let r = 0; r < N_RINGS; r++) {
    const r0 = (r / N_RINGS) * maxR;
    const r1 = ((r + 1) / N_RINGS) * maxR;
    for (let i = 0; i < N_RAYS; i++) {
      if ((i + r) % 2 !== 0) continue; // radial checkerboard
      const a0 = (i / N_RAYS) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / N_RAYS) * Math.PI * 2 - Math.PI / 2;
      const x00 = cx + Math.cos(a0) * r0;
      const y00 = cy + Math.sin(a0) * r0;
      const x10 = cx + Math.cos(a1) * r0;
      const y10 = cy + Math.sin(a1) * r0;
      const x01 = cx + Math.cos(a0) * r1;
      const y01 = cy + Math.sin(a0) * r1;
      const x11 = cx + Math.cos(a1) * r1;
      const y11 = cy + Math.sin(a1) * r1;
      // Annular-sector approximated as a straight-sided quadrilateral
      // — accurate enough at 24 wedge steps to read as smooth.
      d += `M ${x00.toFixed(1)} ${y00.toFixed(1)} L ${x01.toFixed(1)} ${y01.toFixed(1)} L ${x11.toFixed(1)} ${y11.toFixed(1)} L ${x10.toFixed(1)} ${y10.toFixed(1)} Z `;
    }
  }
  return d.trim();
};

// Chaotic angular shards radiating in various directions — long thin
// triangles overlapping each other to create a dense, fractured slab
// reminiscent of paper-cut Op Art. Used for England's first goal.
export const buildEnglandShards = (w: number, h: number): string => {
  // Sparse, bigger shards — fewer pieces with the same even left-to-
  // right distribution so the layout reads cleaner.
  const N = 7;
  const maxDim = Math.max(w, h);
  let d = "";
  for (let i = 0; i < N; i++) {
    const r1 = (Math.sin(i * 12.9898) + 1) / 2;
    const r2 = (Math.sin(i * 78.233) + 1) / 2;
    const r3 = (Math.sin(i * 39.41) + 1) / 2;
    const r4 = (Math.sin(i * 53.91) + 1) / 2;
    const r5 = (Math.sin(i * 17.51) + 1) / 2;

    // Origins evenly stretched across the width so the shards reach
    // both edges; vertical position remains random.
    const ox = (i / Math.max(1, N - 1)) * w + (r1 - 0.5) * (w / N);
    const oy = r2 * h;

    // Direction of the shard's tip — mostly vertical with horizontal
    // jitter so they fan outward.
    const angle = (r3 - 0.5) * Math.PI * 1.6 - Math.PI / 2;

    // Each shard is large — at least 60% of the zone's bigger dimension.
    const len = (0.6 + r4 * 0.55) * maxDim;
    const baseW = (0.08 + r5 * 0.22) * maxDim;

    const tx = ox + Math.cos(angle) * len;
    const ty = oy + Math.sin(angle) * len;
    const perp = angle + Math.PI / 2;
    const bx1 = ox + Math.cos(perp) * (baseW / 2);
    const by1 = oy + Math.sin(perp) * (baseW / 2);
    const bx2 = ox - Math.cos(perp) * (baseW / 2);
    const by2 = oy - Math.sin(perp) * (baseW / 2);

    d += `M ${bx1.toFixed(1)} ${by1.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)} L ${bx2.toFixed(1)} ${by2.toFixed(1)} Z `;
  }
  return d.trim();
};

// Right-triangle grid: tile the zone with square cells, each filled
// with a black right triangle whose right-angle sits at the bottom-
// left corner. The hypotenuse runs from the top-left to the bottom-
// right of the cell. Matches the reference sawtooth pattern.
export const buildBrazilSawtoothGrid = (w: number, h: number): string => {
  // Larger triangles — fewer columns so each cell is big.
  const cols = 5;
  const cellW = w / cols;
  const cellH = cellW; // square cells
  const rows = Math.ceil(h / cellH);
  let d = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW;
      const y = r * cellH;
      // 90° rotated from the original. Right-angle now sits at the
      // TOP-LEFT corner of each cell; hypotenuse runs from top-right
      // to bottom-left. Vertices: top-left, top-right, bottom-left.
      d += `M ${x.toFixed(1)} ${y.toFixed(1)} L ${(x + cellW).toFixed(1)} ${y.toFixed(1)} L ${x.toFixed(1)} ${(y + cellH).toFixed(1)} Z `;
    }
  }
  return d.trim();
};


// Build a path of stacked horizontal "lanes". Each lane is a thin
// rectangle stripe that walks left-to-right with a few small vertical
// step-offsets at segment boundaries — the result reads as mostly-
// straight horizon lines with tiny digital glitch jumps, rather than
// the wavy organic shapes the original SVG produced.
export const buildBrazilStraightStripes = (w: number, h: number): string => {
  // Sparse stripe layout — fewer lanes, slightly thinner, so the
  // pattern reads as a few clear horizons rather than dense noise.
  const stripeCount = 6;
  const stripeH = Math.max(6, h * 0.016);
  let d = "";
  for (let i = 0; i < stripeCount; i++) {
    const yCenter = (i + 0.5) * (h / stripeCount);
    // Random per-lane parameters, deterministic via Math.sin seed.
    const tapered = i % 3 === 2;
    const startX = tapered ? w * (0.08 + 0.04 * (i % 2)) : 0;
    const endX = tapered ? w * (0.78 + 0.1 * (i % 2)) : w;
    const segCount = 4 + ((i * 7) % 4); // 4..7 segments per lane

    const topPts: [number, number][] = [];
    const botPts: [number, number][] = [];

    let yTop = yCenter - stripeH / 2;
    let yBot = yCenter + stripeH / 2;
    topPts.push([startX, yTop]);
    botPts.push([startX, yBot]);

    const segW = (endX - startX) / segCount;
    for (let s = 0; s < segCount; s++) {
      const xEnd = startX + (s + 1) * segW;
      topPts.push([xEnd, yTop]);
      botPts.push([xEnd, yBot]);
      if (s < segCount - 1) {
        // Step up or down by ~70% of stripe thickness at the boundary.
        const seed = Math.sin(i * 31.71 + s * 13.37);
        const dir = seed > 0 ? 1 : -1;
        const step = stripeH * 0.7 * dir;
        yTop += step;
        yBot += step;
        topPts.push([xEnd, yTop]);
        botPts.push([xEnd, yBot]);
      }
    }

    d += `M ${topPts[0]![0].toFixed(1)} ${topPts[0]![1].toFixed(1)} `;
    for (let p = 1; p < topPts.length; p++) {
      d += `L ${topPts[p]![0].toFixed(1)} ${topPts[p]![1].toFixed(1)} `;
    }
    for (let p = botPts.length - 1; p >= 0; p--) {
      d += `L ${botPts[p]![0].toFixed(1)} ${botPts[p]![1].toFixed(1)} `;
    }
    d += "Z ";
  }
  return d.trim();
};
