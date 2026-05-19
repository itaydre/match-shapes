# match-shapes

Generative SVG shape system for football match cards. Each shape is a procedural arrangement of cells (rects, circles, lines, wedges, paths) coloured by a team palette and animated via GSAP. Designed to render live games on a web frontend — drop one shape per match / goal.

## Install

```bash
npm install github:itaydre/match-shapes
# or, for a specific commit:
npm install "github:itaydre/match-shapes#<sha>"
```

Peer deps you must have in the host app:

```bash
npm install react react-dom gsap
```

## Quick start

```tsx
import {
  SHAPE_BUILDERS,
  ShapeRenderer,
  getTeamPalette,
  pickFamilyForGoal,
  stringSeed,
} from "match-shapes";
import { useEffect, useState } from "react";

export function GoalCard({ matchId, scoringTeam, goalId, isHero }) {
  const palette = getTeamPalette(scoringTeam).colors;
  const family = pickFamilyForGoal(matchId, goalId, isHero);
  const SIZE = 520;
  const { cells, focal, wrapAnimation } = SHAPE_BUILDERS[family](
    stringSeed(goalId),
    SIZE,
    palette,
  );

  // rAF playhead for the reveal — bump playToken to replay.
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setFrame(((now - start) / 1000) * 30);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg viewBox={`-${SIZE / 2} -${SIZE / 2} ${SIZE} ${SIZE}`} width={SIZE} height={SIZE}>
      <ShapeRenderer
        cells={cells}
        focal={focal}
        localFrame={frame}
        wrapAnimation={wrapAnimation}
      />
    </svg>
  );
}
```

## Public API

| Export                | What it is                                                                 |
| --------------------- | -------------------------------------------------------------------------- |
| `SHAPE_BUILDERS`      | `Record<ShapeFamily, ShapeBuilder>` — every shape, keyed by family name.   |
| `SHAPE_FAMILIES`      | `ShapeFamily[]` — the canonical ordering for iteration / pickers.          |
| `ShapeRenderer`       | React component that animates a cell list with GSAP.                       |
| `Cell`, `ShapeBuilder`, `RevealOverrides`, `WrapAnimation` | Core types. |
| `TEAM_PALETTES`       | 13 international kit palettes (5 colours each).                            |
| `getTeamPalette`      | Look up palette by team name (case-insensitive, partial match).            |
| `HERO_FAMILIES`       | Curated subset reserved for the most-important goal in a match.            |
| `pickFamilyForGoal`   | One-call picker: pass `matchId`, `goalId`, `isHero` → returns a family.    |
| `familiesForGame`     | Returns the deterministic family tour for a match id.                      |
| `pickHeroFamily`      | Deterministic hero pick per match id.                                      |
| `stringSeed`          | 5381-style string → integer hash. Useful as a seed for builders.           |

## Concepts

A **`ShapeBuilder`** is a pure function `(seed, size, palette) → { cells, focal, wrapAnimation? }`. Given a match-id-derived seed and a team's 5-colour palette, it returns a list of `Cell` primitives plus an optional `wrapAnimation` (continuous transform string).

A **`Cell`** is one of `rect | circle | line | wedge | path`, plus reveal metadata (`revealOrder`, `revealMode`, `birthOrigin`, `noSpin`, `vortexSpeed`, ripple props).

The **`ShapeRenderer`** wires each cell into a `<g>` and animates `transform`, `scale`, and `rotation` via GSAP based on the cell's reveal mode. `localFrame` drives the playhead (one `requestAnimationFrame` tick = ~1/30 frame). `playToken` re-fires the reveal when bumped.

## Variants

Some shapes are parameterised — e.g. `buildVortexDiscWithParams` is the core; `buildVortexDisc`, `buildVortexDiscDiagonal`, `buildVortexDiscFlat`, `buildVortexDiscSpinner` are one-line wrappers passing different camera angles and ring counts. Adding a new visual variant is ~5 lines + a registry entry.

## Updating

You're consuming this from GitHub `main`. To get the latest shapes the maintainer has pushed:

```bash
# In your project root
npm update match-shapes
# (or: rm -rf node_modules/match-shapes && npm install)
```

For CI/CD pipelines: `npm install` on each build will fetch the current `main`. To prefer a stable tag instead, change the dependency to `github:itaydre/match-shapes#v0.1.0`.

## Licence

MIT.
