# Match Card

A 9‑second animated final card for a World Cup match, built with **Remotion** (React → MP4). Animation goes from the kickoff state (0‑0, midpoint at 50/50) to the final state where each goal blooms as an abstract flag‑colored composition placed on an invisible team grid. Late and decisive goals get extra visual weight via a drama model.

## Why Remotion (not Three.js / WebGL)

* React component model — every visual primitive is composable JSX/SVG.
* First‑class **video export** to MP4/WebM via `remotion render`.
* **Remotion Studio** gives the sliders for free via a Zod schema (no custom UI to build).
* SVG + CSS handles every shape we need; no GPU work required, no headless‑Chrome canvas dance.
* Frame‑accurate, deterministic, hash‑stable renders — `useCurrentFrame()` is the single source of truth.

## Run

```bash
npm install
npm run dev          # opens Remotion Studio with live sliders
npm run render       # renders out/match-card.mp4 (9s, 1080×2340 — iPhone 19.5:9)
npm run render:still # renders the final frame as a PNG poster
npm run playground   # opens the Vite-based goal-shape playground
```

## How the timeline works

* Total: **9 s @ 30 fps = 270 frames**, output **1080 × 2340** (iPhone 19.5:9 portrait)
* Frames `0–14` — kickoff hold (0‑0, midpoint 50/50)
* Frames `15–239` — match plays out:
  * The midpoint Y is continuously recomputed from the cumulative possession share (`possessionAtFrame`). When the home team dominates, the line drops, giving them more visual real estate.
  * Each match minute maps linearly to a frame (`minuteToFrame`), so a goal at minute 22 fires at frame ~52, etc.
  * Match events (shots, fouls, yellows, reds, corners, free kicks, penalties) populate as a deterministic dot scatter, staggered by minute.
  * Goals trigger an abstract artwork in their team's grid cell.
* Frames `240–269` — final state hold with a small settle flash.

## Goal weight model — emotional payload

`src/lib/goalWeight.ts` returns a 0..1 drama weight per goal that drives **size, animation duration, ring/wedge density, stroke width, breath amplitude, and a brief team‑color screen flash** for very high‑weight goals.

The model blends four signals:

| Signal             | What it captures                                         | Max contribution |
| ------------------ | -------------------------------------------------------- | ---------------- |
| Late ramp          | 60'→90', the closer to full time the bigger              | +0.35            |
| Early shock        | Goals in the first ~6 minutes                            | +0.18            |
| Decisive state     | Equalizer / go‑ahead from behind / padding penalty       | ±0.30            |
| Game winner bonus  | Last goal that gave the winning team the lead it kept    | +0.20            |

Output is clamped to `[0.2, 1.0]`. A 90' equalizer from behind hits ~0.88. A 90+' winner from behind hits 1.0. A padding goal when up 4‑0 settles at 0.20.

How weight maps into the GoalArt component (see `src/components/GoalArt.tsx`):

* `sizeMul = 1 + weight * 1.4` — the cell rectangle grows up to 2.4×
* Spring `durationInFrames = 28 + weight * 26` — bigger goals enter slower
* Spring `damping = 14 - weight * 6` — bigger goals bounce harder
* Ring/wedge counts multiplied by `1 + weight * 0.6`
* Stroke widths multiplied by `1 + weight * 0.7`
* Post‑entry breath amplitude scales with weight
* Weight > 0.7 triggers a brief team‑color overlay flash (`DramaticFlash`)

The default scenario in `src/Root.tsx` is tuned to demonstrate the spread:

```ts
{ team: "home", minute: 22, style: 0, cell: 0  }, // 1-0 ripples — moderate weight
{ team: "home", minute: 41, style: 1, cell: 4  }, // 2-0 sunburst — low weight (padding)
{ team: "away", minute: 62, style: 1, cell: 0  }, // 2-1 sunburst — low weight
{ team: "away", minute: 90, style: 3, cell: 14 }, // 2-2 dramatic equalizer — top weight
```

## Sliders (Remotion Studio)

| Prop          | Range  | What it does                                                                |
| ------------- | ------ | --------------------------------------------------------------------------- |
| `emotion`     | 0–1    | Post‑entry breath/pulse amplitude on every goal artwork                     |
| `clash`       | 0–1    | Geometric distortion on the radial burst + checker wheel                    |
| `shotDensity` | 0–1    | How many event marks populate the field                                     |
| `showGrid`    | bool   | Reveals the dotted invisible grids per team                                 |
| `showShots`   | bool   | Toggles the entire match‑events scatter and legend                          |

Plus colors: `home.flagPrimary/Secondary/Accent`, `away.flagPrimary/Secondary/Accent` are all `zColor()` pickers.

## Goal‑shape playground

Run `npm run playground` to open a Vite app at http://localhost:5173 with a live preview of every goal shape and sliders for every parameter (ring count, stroke width, wedge count, slice rotation, clash, color, weight, etc.).

The playground imports the same `src/shapes/goal-shapes.tsx` components the card uses, so anything you tune there reflects the actual shape rendered into the video. The right panel emits a JSON snippet you can paste into a goal entry as you extend the schema for per‑goal parameter overrides.

## Editing the match

Open `src/Root.tsx` and edit `defaultProps`:

```ts
goals: [
  { team: "home", minute: 22, style: 0, cell: 0 },
  { team: "away", minute: 90, style: 3, cell: 14 },
],
possessionTimeline: buildDefaultTimeline(0.58, 0.16),
```

Goal `style`:

* `0` — concentric quarter‑arcs (corner ripples)
* `1` — radial sunburst of slim wedges
* `2` — dome of ribbed arches
* `3` — checkered pie wheel (Croatia‑flag‑like glitch ball)

Grid is 5 cols × 4 rows per team half. `cell` is `0..19` (row‑major).

## Event taxonomy

The dot scatter encodes seven event types — each gets a distinct glyph and uses the team's flag color so you can tell who did what:

* **shot** — filled dot
* **foul** — open ring
* **yellow** — yellow card rectangle
* **red** — red card rectangle
* **corner** — triangle
* **free kick** — short dash
* **penalty** — concentric ring/dot

The legend renders inside the bottom of the panel so the meaning is always on the card itself.
