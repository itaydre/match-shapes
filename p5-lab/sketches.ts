import type p5 from "p5";

// Sketch authoring contract. Each sketch is a factory that returns a
// p5 sketch function bound to a `controls` object whose values can be
// tweaked at runtime from the UI sliders. Sketches read controls every
// frame so changes feel live.
//
// To add a new sketch:
//   1. Define its controls schema and defaults below.
//   2. Add an entry to SKETCHES with `id`, `name`, `controls`, `factory`.

export type ControlSpec =
  | { kind: "number"; label: string; min: number; max: number; step: number; value: number }
  | { kind: "color"; label: string; value: string }
  | { kind: "toggle"; label: string; value: boolean };

export type Controls = Record<string, ControlSpec>;

export type ControlValues = Record<string, number | string | boolean>;

export const valuesOf = (controls: Controls): ControlValues => {
  const out: ControlValues = {};
  for (const k of Object.keys(controls)) out[k] = controls[k]!.value;
  return out;
};

export type SketchFactory = (
  getValues: () => ControlValues,
) => (p: p5) => void;

export type Sketch = {
  id: string;
  name: string;
  description: string;
  controls: Controls;
  factory: SketchFactory;
};

// ── Shared helpers ──────────────────────────────────────────────────────────

// Sketch canvas dimensions — matches the match-card pitch panel aspect
// ratio (960 × 1840 in Remotion coords, ≈ 1 : 1.917). Sketches render
// at this aspect so they fill the pitch with no letterboxing when shown
// inside the match-card preview frame.
const CW = 540;
const CH = 1040;

const drawBackdrop = (p: p5, bg: string) => {
  p.background(bg);
};

// ── 1. Wedge Burst — the match-card animation, p5-native ────────────────────

const wedgeBurst: Sketch = {
  id: "wedge-burst",
  name: "Wedge Burst",
  description: "Radial wedges in the scoring team palette, growing from a focal point.",
  controls: {
    wedgeCount: { kind: "number", label: "Wedge count", min: 6, max: 200, step: 1, value: 60 },
    reach: { kind: "number", label: "Reach", min: 0, max: 1.4, step: 0.01, value: 0.7 },
    thickness: { kind: "number", label: "Base thickness (rad)", min: 0.005, max: 0.2, step: 0.001, value: 0.04 },
    focalX: { kind: "number", label: "Focal X", min: 0, max: 1, step: 0.005, value: 0.5 },
    focalY: { kind: "number", label: "Focal Y", min: 0, max: 1, step: 0.005, value: 0.5 },
    speed: { kind: "number", label: "Anim speed", min: 0, max: 4, step: 0.05, value: 1 },
    longProb: { kind: "number", label: "Long spike prob", min: 0, max: 1, step: 0.01, value: 0.2 },
    color1: { kind: "color", label: "Color A", value: "#009C3B" },
    color2: { kind: "color", label: "Color B", value: "#FFDF00" },
    color3: { kind: "color", label: "Color C", value: "#002776" },
    backdrop: { kind: "color", label: "Backdrop", value: "#F1EEE7" },
    persist: { kind: "toggle", label: "Persist (don't fade)", value: true },
  },
  factory: (getValues) => (p: p5) => {
    let t = 0;
    p.setup = () => {
      p.createCanvas(CW, CH);
      p.noStroke();
    };
    p.draw = () => {
      const v = getValues();
      drawBackdrop(p, v.backdrop as string);
      const speed = v.speed as number;
      t += 1 / 60 * speed;
      const grow = Math.min(1, t / 0.5);
      const progress = (v.persist as boolean) ? grow : Math.max(0, 1 - Math.abs(((t % 3) - 1.5) / 1.5));
      const fx = (v.focalX as number) * CW;
      const fy = (v.focalY as number) * CH;
      const reachMax = Math.hypot(CW, CH) * 0.55 * (v.reach as number);
      const palette = [v.color1, v.color2, v.color3] as string[];
      const N = Math.floor(v.wedgeCount as number);
      for (let w = 0; w < N; w++) {
        const r1 = (Math.sin(w * 12.9898) + 1) / 2;
        const r2 = (Math.sin(w * 78.233) + 1) / 2;
        const r3 = (Math.sin(w * 39.41) + 1) / 2;
        const r4 = (Math.sin(w * 53.91) + 1) / 2;
        const angle = r1 * Math.PI * 2;
        const isLong = r2 < (v.longProb as number);
        const len = (isLong ? 0.55 + r3 * 0.2 : 0.12 + r3 * 0.25) * reachMax * progress;
        const baseAngle = (v.thickness as number) * (0.5 + r4);
        const a0 = angle - baseAngle / 2;
        const a1 = angle + baseAngle / 2;
        p.fill(palette[w % palette.length]!);
        p.beginShape();
        p.vertex(fx, fy);
        p.vertex(fx + Math.cos(a0) * len, fy + Math.sin(a0) * len);
        p.vertex(fx + Math.cos(a1) * len, fy + Math.sin(a1) * len);
        p.endShape(p.CLOSE);
      }
    };
  },
};

// ── 2. Particle Explosion ───────────────────────────────────────────────────

const particleExplosion: Sketch = {
  id: "particles",
  name: "Particle Explosion",
  description: "Goal-celebration burst of fading particles with gravity.",
  controls: {
    count: { kind: "number", label: "Particles", min: 20, max: 800, step: 10, value: 240 },
    speed: { kind: "number", label: "Initial speed", min: 1, max: 30, step: 0.5, value: 12 },
    gravity: { kind: "number", label: "Gravity", min: -0.5, max: 1.5, step: 0.01, value: 0.25 },
    friction: { kind: "number", label: "Friction", min: 0.9, max: 1, step: 0.001, value: 0.98 },
    size: { kind: "number", label: "Particle size", min: 1, max: 30, step: 0.5, value: 8 },
    decay: { kind: "number", label: "Fade decay", min: 0.001, max: 0.05, step: 0.001, value: 0.012 },
    respawnMs: { kind: "number", label: "Respawn (ms)", min: 200, max: 6000, step: 100, value: 2000 },
    color1: { kind: "color", label: "Color A", value: "#D5311E" },
    color2: { kind: "color", label: "Color B", value: "#FFFFFF" },
    backdrop: { kind: "color", label: "Backdrop", value: "#0e0e0e" },
  },
  factory: (getValues) => (p: p5) => {
    type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
    let particles: Particle[] = [];
    let lastSpawn = 0;
    const respawn = () => {
      const v = getValues();
      const count = Math.floor(v.count as number);
      const speed = v.speed as number;
      const palette = [v.color1, v.color2] as string[];
      particles = [];
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = speed * (0.4 + Math.random() * 0.8);
        particles.push({
          x: CW / 2,
          y: CH / 2,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 1,
          color: palette[i % palette.length]!,
        });
      }
    };
    p.setup = () => {
      p.createCanvas(CW, CH);
      p.noStroke();
      respawn();
      lastSpawn = p.millis();
    };
    p.draw = () => {
      const v = getValues();
      drawBackdrop(p, v.backdrop as string);
      const now = p.millis();
      if (now - lastSpawn > (v.respawnMs as number)) {
        respawn();
        lastSpawn = now;
      }
      const g = v.gravity as number;
      const fr = v.friction as number;
      const size = v.size as number;
      const decay = v.decay as number;
      for (const part of particles) {
        part.vx *= fr;
        part.vy *= fr;
        part.vy += g;
        part.x += part.vx;
        part.y += part.vy;
        part.life -= decay;
        if (part.life <= 0) continue;
        const col = p.color(part.color);
        col.setAlpha(255 * part.life);
        p.fill(col);
        p.circle(part.x, part.y, size * part.life);
      }
    };
  },
};

// ── 3. Concentric Ring Pulse ────────────────────────────────────────────────

const ringPulse: Sketch = {
  id: "rings",
  name: "Ring Pulse",
  description: "Concentric rings expanding outward, perfect for clean goal pulses.",
  controls: {
    pulseRate: { kind: "number", label: "Pulse rate (Hz)", min: 0.2, max: 4, step: 0.05, value: 1 },
    ringCount: { kind: "number", label: "Concurrent rings", min: 1, max: 12, step: 1, value: 5 },
    strokeWidth: { kind: "number", label: "Stroke width", min: 1, max: 30, step: 0.5, value: 6 },
    maxRadius: { kind: "number", label: "Max radius", min: 100, max: 700, step: 10, value: 360 },
    color1: { kind: "color", label: "Ring color", value: "#D5311E" },
    backdrop: { kind: "color", label: "Backdrop", value: "#FAF8F2" },
  },
  factory: (getValues) => (p: p5) => {
    p.setup = () => {
      p.createCanvas(CW, CH);
      p.noFill();
    };
    p.draw = () => {
      const v = getValues();
      drawBackdrop(p, v.backdrop as string);
      const rate = v.pulseRate as number;
      const n = Math.floor(v.ringCount as number);
      const maxR = v.maxRadius as number;
      const sw = v.strokeWidth as number;
      const color = p.color(v.color1 as string);
      p.stroke(color);
      const t = (p.millis() / 1000) * rate;
      for (let i = 0; i < n; i++) {
        const phase = (t + i / n) % 1;
        const r = phase * maxR;
        const alpha = 255 * (1 - phase);
        const ringCol = p.color(v.color1 as string);
        ringCol.setAlpha(alpha);
        p.stroke(ringCol);
        p.strokeWeight(sw);
        p.circle(CW / 2, CH / 2, r * 2);
      }
    };
  },
};

// ── 4. Flow Field ───────────────────────────────────────────────────────────

const flowField: Sketch = {
  id: "flow",
  name: "Flow Field",
  description: "Perlin-noise particle flow — abstract texture you can pour into a goal moment.",
  controls: {
    particleCount: { kind: "number", label: "Particles", min: 100, max: 5000, step: 50, value: 1200 },
    noiseScale: { kind: "number", label: "Noise scale", min: 0.001, max: 0.02, step: 0.0005, value: 0.005 },
    speed: { kind: "number", label: "Particle speed", min: 0.2, max: 6, step: 0.1, value: 1.6 },
    alpha: { kind: "number", label: "Trail alpha", min: 5, max: 100, step: 1, value: 20 },
    fadeBg: { kind: "toggle", label: "Fade old trails", value: true },
    color1: { kind: "color", label: "Particle color", value: "#FFDF00" },
    backdrop: { kind: "color", label: "Backdrop", value: "#002776" },
  },
  factory: (getValues) => (p: p5) => {
    type Mover = { x: number; y: number };
    let movers: Mover[] = [];
    p.setup = () => {
      p.createCanvas(CW, CH);
      const v = getValues();
      p.background(v.backdrop as string);
      const count = Math.floor(v.particleCount as number);
      movers = Array.from({ length: count }, () => ({
        x: Math.random() * CW,
        y: Math.random() * CH,
      }));
    };
    p.draw = () => {
      const v = getValues();
      if (v.fadeBg as boolean) {
        const c = p.color(v.backdrop as string);
        c.setAlpha(v.alpha as number);
        p.noStroke();
        p.fill(c);
        p.rect(0, 0, CW, CH);
      } else {
        drawBackdrop(p, v.backdrop as string);
      }
      const scale = v.noiseScale as number;
      const speed = v.speed as number;
      const desired = Math.floor(v.particleCount as number);
      while (movers.length < desired)
        movers.push({ x: Math.random() * CW, y: Math.random() * CH });
      while (movers.length > desired) movers.pop();
      p.stroke(v.color1 as string);
      p.strokeWeight(1.2);
      for (const m of movers) {
        const n = p.noise(m.x * scale, m.y * scale, p.millis() / 5000);
        const a = n * Math.PI * 4;
        const nx = m.x + Math.cos(a) * speed;
        const ny = m.y + Math.sin(a) * speed;
        p.line(m.x, m.y, nx, ny);
        m.x = nx;
        m.y = ny;
        if (m.x < 0 || m.x > CW || m.y < 0 || m.y > CH) {
          m.x = Math.random() * CW;
          m.y = Math.random() * CH;
        }
      }
    };
  },
};

// ── 5. Pixel Mosaic ─────────────────────────────────────────────────────────

const pixelMosaic: Sketch = {
  id: "mosaic",
  name: "Pixel Mosaic",
  description: "Stepped-grid colour blocks that breathe with noise — flag-pattern feel.",
  controls: {
    cols: { kind: "number", label: "Columns", min: 4, max: 80, step: 1, value: 20 },
    noiseScale: { kind: "number", label: "Noise scale", min: 0.05, max: 1, step: 0.01, value: 0.18 },
    timeSpeed: { kind: "number", label: "Time speed", min: 0, max: 3, step: 0.05, value: 0.4 },
    color1: { kind: "color", label: "Color A", value: "#D5311E" },
    color2: { kind: "color", label: "Color B", value: "#FFFFFF" },
    color3: { kind: "color", label: "Color C", value: "#0E0E0E" },
    backdrop: { kind: "color", label: "Backdrop", value: "#FAF8F2" },
  },
  factory: (getValues) => (p: p5) => {
    p.setup = () => {
      p.createCanvas(CW, CH);
      p.noStroke();
    };
    p.draw = () => {
      const v = getValues();
      drawBackdrop(p, v.backdrop as string);
      const cols = Math.max(2, Math.floor(v.cols as number));
      const cell = CW / cols;
      const rows = Math.ceil(CH / cell);
      const t = (p.millis() / 1000) * (v.timeSpeed as number);
      const palette = [v.color1, v.color2, v.color3] as string[];
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          const n = p.noise(cx * (v.noiseScale as number), cy * (v.noiseScale as number), t);
          const idx = Math.floor(n * palette.length * 1.4) % palette.length;
          p.fill(palette[idx]!);
          p.rect(cx * cell, cy * cell, cell + 0.5, cell + 0.5);
        }
      }
    };
  },
};

// ── 6. Op Art Waves — Bridget Riley horizontal undulations ──────────────────

const opArtWaves: Sketch = {
  id: "op-waves",
  name: "Op Art Waves",
  description: "Stacked horizontal stripes warped by sine waves — Bridget Riley 'Fall' / 'Cataract' feel.",
  controls: {
    stripeCount: { kind: "number", label: "Stripe count", min: 8, max: 80, step: 1, value: 28 },
    stripeRatio: { kind: "number", label: "Stripe fill ratio", min: 0.2, max: 0.95, step: 0.01, value: 0.55 },
    waveAmp: { kind: "number", label: "Wave amplitude", min: 0, max: 200, step: 1, value: 50 },
    waveFreq: { kind: "number", label: "Wave frequency", min: 0.002, max: 0.05, step: 0.0005, value: 0.012 },
    phaseShift: { kind: "number", label: "Per-row phase shift", min: 0, max: 1, step: 0.01, value: 0.35 },
    rowAmpFalloff: { kind: "number", label: "Row amp falloff", min: -1, max: 1, step: 0.01, value: 0 },
    timeSpeed: { kind: "number", label: "Time speed", min: -3, max: 3, step: 0.05, value: 0.6 },
    segments: { kind: "number", label: "Curve segments", min: 40, max: 400, step: 4, value: 160 },
    stripeColor: { kind: "color", label: "Stripe color", value: "#0E0E0E" },
    backdrop: { kind: "color", label: "Backdrop", value: "#FFFFFF" },
  },
  factory: (getValues) => (p: p5) => {
    p.setup = () => {
      p.createCanvas(CW, CH);
      p.noStroke();
    };
    p.draw = () => {
      const v = getValues();
      drawBackdrop(p, v.backdrop as string);
      p.fill(v.stripeColor as string);
      const N = Math.max(2, Math.floor(v.stripeCount as number));
      const stripeH = CH / N;
      const fillH = stripeH * (v.stripeRatio as number);
      const seg = Math.max(8, Math.floor(v.segments as number));
      const dx = CW / seg;
      const t = (p.millis() / 1000) * (v.timeSpeed as number);
      const amp = v.waveAmp as number;
      const freq = v.waveFreq as number;
      const phase = v.phaseShift as number;
      const falloff = v.rowAmpFalloff as number;

      for (let row = 0; row < N; row++) {
        const yCenter = (row + 0.5) * stripeH;
        const rowPhase = row * phase;
        // Row-dependent amplitude scaling — falloff < 0 squeezes mid-rows,
        // > 0 squeezes edges; 0 keeps amplitude uniform.
        const rowFromCenter = (row - (N - 1) / 2) / ((N - 1) / 2);
        const rowAmp = amp * (1 + falloff * (1 - Math.abs(rowFromCenter)));
        p.beginShape();
        for (let s = 0; s <= seg; s++) {
          const x = s * dx;
          const y = yCenter + Math.sin(x * freq + t + rowPhase) * rowAmp - fillH / 2;
          p.vertex(x, y);
        }
        for (let s = seg; s >= 0; s--) {
          const x = s * dx;
          const y = yCenter + Math.sin(x * freq + t + rowPhase) * rowAmp + fillH / 2;
          p.vertex(x, y);
        }
        p.endShape(p.CLOSE);
      }
    };
  },
};

// ── 7. Radiant Fan — converging stripes from a focal point ──────────────────

const radiantFan: Sketch = {
  id: "radiant-fan",
  name: "Radiant Fan",
  description: "Alternating black-and-white wedges fanning from a focal point — Op Art starburst.",
  controls: {
    rays: { kind: "number", label: "Ray count", min: 6, max: 200, step: 2, value: 48 },
    focalX: { kind: "number", label: "Focal X", min: -0.5, max: 1.5, step: 0.005, value: 1 },
    focalY: { kind: "number", label: "Focal Y", min: -0.5, max: 1.5, step: 0.005, value: 0.5 },
    spread: { kind: "number", label: "Spread (deg)", min: 30, max: 360, step: 1, value: 180 },
    centerAngle: { kind: "number", label: "Center angle (deg)", min: -180, max: 180, step: 1, value: 180 },
    rotateSpeed: { kind: "number", label: "Rotate speed", min: -90, max: 90, step: 1, value: 6 },
    duty: { kind: "number", label: "Fill ratio", min: 0.1, max: 0.9, step: 0.01, value: 0.5 },
    rayLength: { kind: "number", label: "Ray length", min: 0.5, max: 3, step: 0.01, value: 1.6 },
    color1: { kind: "color", label: "Ray color", value: "#0E0E0E" },
    backdrop: { kind: "color", label: "Backdrop", value: "#FFFFFF" },
  },
  factory: (getValues) => (p: p5) => {
    p.setup = () => {
      p.createCanvas(CW, CH);
      p.noStroke();
    };
    p.draw = () => {
      const v = getValues();
      drawBackdrop(p, v.backdrop as string);
      p.fill(v.color1 as string);
      const N = Math.max(2, Math.floor(v.rays as number));
      const fx = (v.focalX as number) * CW;
      const fy = (v.focalY as number) * CH;
      const spread = ((v.spread as number) * Math.PI) / 180;
      const centerAng = ((v.centerAngle as number) * Math.PI) / 180;
      const rotate =
        (((v.rotateSpeed as number) * Math.PI) / 180) * (p.millis() / 1000);
      const duty = v.duty as number;
      const reach = Math.max(CW, CH) * (v.rayLength as number);
      const slot = spread / N; // angular slot per ray pair
      const half = slot * duty * 0.5;
      const start = centerAng - spread / 2 + rotate;

      for (let i = 0; i < N; i++) {
        if (i % 2 === 1) continue; // alternating fill / gap
        const a = start + (i + 0.5) * slot;
        const a0 = a - half;
        const a1 = a + half;
        p.beginShape();
        p.vertex(fx, fy);
        p.vertex(fx + Math.cos(a0) * reach, fy + Math.sin(a0) * reach);
        p.vertex(fx + Math.cos(a1) * reach, fy + Math.sin(a1) * reach);
        p.endShape(p.CLOSE);
      }
    };
  },
};

// ── 8. Moiré Grid — interfering diagonal lines ──────────────────────────────

const moireGrid: Sketch = {
  id: "moire",
  name: "Moiré Grid",
  description: "Two overlapping line grids drifting against each other — pure interference texture.",
  controls: {
    lines: { kind: "number", label: "Lines per layer", min: 20, max: 200, step: 1, value: 70 },
    angle1: { kind: "number", label: "Layer 1 angle (deg)", min: 0, max: 180, step: 1, value: 90 },
    angle2: { kind: "number", label: "Layer 2 angle (deg)", min: 0, max: 180, step: 1, value: 88 },
    drift: { kind: "number", label: "Drift speed", min: 0, max: 30, step: 0.5, value: 8 },
    thickness: { kind: "number", label: "Line thickness", min: 1, max: 12, step: 0.5, value: 3 },
    color1: { kind: "color", label: "Layer 1 color", value: "#0E0E0E" },
    color2: { kind: "color", label: "Layer 2 color", value: "#0E0E0E" },
    backdrop: { kind: "color", label: "Backdrop", value: "#FFFFFF" },
  },
  factory: (getValues) => (p: p5) => {
    p.setup = () => {
      p.createCanvas(CW, CH);
    };
    p.draw = () => {
      const v = getValues();
      drawBackdrop(p, v.backdrop as string);
      const N = Math.max(4, Math.floor(v.lines as number));
      const SIZE = Math.max(CW, CH);
      const spacing = SIZE / N;
      const t = (p.millis() / 1000) * (v.drift as number);
      p.strokeWeight(v.thickness as number);
      // Draw a layer of parallel lines at `angleDeg`, offset by `phase` px.
      const drawLayer = (angleDeg: number, phase: number, color: string) => {
        p.stroke(color);
        const rad = (angleDeg * Math.PI) / 180;
        const dx = -Math.sin(rad);
        const dy = Math.cos(rad);
        // Lines are perpendicular to (dx,dy); we step along (dx,dy) and
        // draw a long segment along (-dy, dx).
        const length = SIZE * 2;
        const cxC = CW / 2;
        const cyC = CH / 2;
        for (let i = -N; i < N * 2; i++) {
          const c = (i * spacing + phase) % SIZE;
          const x0 = cxC + dx * (c - SIZE / 2) - -dy * length;
          const y0 = cyC + dy * (c - SIZE / 2) - dx * length;
          const x1 = cxC + dx * (c - SIZE / 2) + -dy * length;
          const y1 = cyC + dy * (c - SIZE / 2) + dx * length;
          p.line(x0, y0, x1, y1);
        }
      };
      drawLayer(v.angle1 as number, t, v.color1 as string);
      drawLayer(v.angle2 as number, -t, v.color2 as string);
    };
  },
};

// ── 9. Fractured Fan — radiant fan sliced into geometric panels ─────────────

const fracturedFan: Sketch = {
  id: "fractured-fan",
  name: "Fractured Fan",
  description: "Radiant fan broken into geometric panels — Op Art collage with shifted vanishing points.",
  controls: {
    panels: { kind: "number", label: "Panels", min: 2, max: 8, step: 1, value: 4 },
    raysPerPanel: { kind: "number", label: "Rays per panel", min: 6, max: 80, step: 2, value: 20 },
    duty: { kind: "number", label: "Fill ratio", min: 0.2, max: 0.9, step: 0.01, value: 0.5 },
    rotateSpeed: { kind: "number", label: "Rotate speed", min: -90, max: 90, step: 1, value: 8 },
    color1: { kind: "color", label: "Ray color", value: "#0E0E0E" },
    backdrop: { kind: "color", label: "Backdrop", value: "#FAF8F2" },
  },
  factory: (getValues) => (p: p5) => {
    p.setup = () => {
      p.createCanvas(CW, CH);
      p.noStroke();
    };
    p.draw = () => {
      const v = getValues();
      drawBackdrop(p, v.backdrop as string);
      p.fill(v.color1 as string);
      const panels = Math.max(1, Math.floor(v.panels as number));
      const raysPer = Math.max(2, Math.floor(v.raysPerPanel as number));
      const duty = v.duty as number;
      const rotate =
        (((v.rotateSpeed as number) * Math.PI) / 180) * (p.millis() / 1000);
      const cols = Math.ceil(Math.sqrt(panels));
      const rows = Math.ceil(panels / cols);
      const cellW = CW / cols;
      const cellH = CH / rows;
      for (let pi = 0; pi < panels; pi++) {
        const cx = (pi % cols) * cellW;
        const cy = Math.floor(pi / cols) * cellH;
        // Each panel has its own focal point near a corner — gives the
        // collage feel from the reference where vanishing points differ.
        const corner = pi % 4;
        const fx = cx + (corner === 1 || corner === 2 ? cellW : 0);
        const fy = cy + (corner === 2 || corner === 3 ? cellH : 0);
        // Clip to this panel via push/pop + rect clip.
        p.push();
        p.drawingContext.save();
        p.drawingContext.beginPath();
        p.drawingContext.rect(cx, cy, cellW, cellH);
        p.drawingContext.clip();
        const startAng = -Math.PI / 2 + rotate * (pi % 2 === 0 ? 1 : -1);
        const spread = Math.PI;
        const slot = spread / raysPer;
        const half = slot * duty * 0.5;
        const reach = Math.hypot(cellW, cellH) * 1.6;
        for (let i = 0; i < raysPer; i++) {
          if (i % 2 === 1) continue;
          const a = startAng + (i + 0.5) * slot;
          const a0 = a - half;
          const a1 = a + half;
          p.beginShape();
          p.vertex(fx, fy);
          p.vertex(fx + Math.cos(a0) * reach, fy + Math.sin(a0) * reach);
          p.vertex(fx + Math.cos(a1) * reach, fy + Math.sin(a1) * reach);
          p.endShape(p.CLOSE);
        }
        p.drawingContext.restore();
        p.pop();
      }
      // Panel grid outlines
      p.stroke(0, 40);
      p.strokeWeight(1);
      p.noFill();
      for (let c = 1; c < cols; c++) p.line(c * cellW, 0, c * cellW, CH);
      for (let r = 1; r < rows; r++) p.line(0, r * cellH, CW, r * cellH);
    };
  },
};

export const SKETCHES: Sketch[] = [
  wedgeBurst,
  particleExplosion,
  ringPulse,
  flowField,
  pixelMosaic,
  opArtWaves,
  radiantFan,
  moireGrid,
  fracturedFan,
];
