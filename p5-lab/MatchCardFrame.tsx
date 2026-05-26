import React from "react";

// Faithful replica of the Remotion BaseLayout chrome — 1080×2340 9:16
// card, beige bg, big team names, color split bars, rotated side
// captions (competition left, venue/date right), white pitch panel
// in the middle. Scores are drawn HUGE over the upper and lower halves
// of the pitch (home top, away bottom) so we can see the animation
// layered behind them just like the real composition.

export type MatchCardData = {
  competition: string;
  venue: string;
  date: string;
  home: { name: string; flagPrimary: string; flagSecondary: string };
  away: { name: string; flagPrimary: string; flagSecondary: string };
  homeScore: number;
  awayScore: number;
};

export const DEFAULT_MATCH: MatchCardData = {
  competition: "FIFA WORLD CUP 2026",
  venue: "LEVI'S STADIUM",
  date: "30.6.2026",
  home: { name: "ENGLAND", flagPrimary: "#D5311E", flagSecondary: "#FFFFFF" },
  away: { name: "BRAZIL", flagPrimary: "#009C3B", flagSecondary: "#FFDF00" },
  homeScore: 2,
  awayScore: 1,
};

// Real-card coordinates (Remotion canvas: 1080×2340).
const CANVAS_W = 1080;
const CANVAS_H = 2340;
const SIDE_INSET = 60;
const TOP_INSET = 140;
const BOTTOM_INSET = 140;
const BAR_THICKNESS = 14;
const PANEL = {
  left: SIDE_INSET,
  top: TOP_INSET + BAR_THICKNESS,
  right: CANVAS_W - SIDE_INSET,
  bottom: CANVAS_H - (BOTTOM_INSET + BAR_THICKNESS),
};
const PANEL_W = PANEL.right - PANEL.left;
const PANEL_H = PANEL.bottom - PANEL.top;

export const MatchCardFrame: React.FC<{
  match?: MatchCardData;
  children: React.ReactNode;
}> = ({ match = DEFAULT_MATCH, children }) => {
  return (
    <div style={frameOuter}>
      {/* The card is rendered as an SVG viewBox at 1080x2340 so every
          element scales proportionally and matches the Remotion layout
          exactly. The pitch animation is mounted as foreignObject. */}
      <svg
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        style={cardSvg}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Beige backdrop */}
        <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#F1EEE7" />

        {/* HOME team name (top) */}
        <text
          x={CANVAS_W / 2}
          y={36 + 60}
          textAnchor="middle"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight={900}
          fontSize={72}
          letterSpacing="4"
          fill={match.home.flagPrimary}
        >
          {match.home.name.toUpperCase()}
        </text>

        {/* AWAY team name (bottom) */}
        <text
          x={CANVAS_W / 2}
          y={CANVAS_H - 36}
          textAnchor="middle"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight={900}
          fontSize={72}
          letterSpacing="4"
          fill={match.away.flagPrimary}
        >
          {match.away.name.toUpperCase()}
        </text>

        {/* Top color bars: white full + home accent centered */}
        <rect
          x={SIDE_INSET}
          y={TOP_INSET}
          width={CANVAS_W - 2 * SIDE_INSET}
          height={BAR_THICKNESS}
          fill="#FFFFFF"
        />
        <rect
          x={CANVAS_W * 0.3}
          y={TOP_INSET}
          width={CANVAS_W * 0.4}
          height={BAR_THICKNESS}
          fill={match.home.flagPrimary}
        />

        {/* Bottom color bars: white full + home left | away right */}
        <rect
          x={SIDE_INSET}
          y={CANVAS_H - BOTTOM_INSET - BAR_THICKNESS}
          width={CANVAS_W - 2 * SIDE_INSET}
          height={BAR_THICKNESS}
          fill="#FFFFFF"
        />
        <rect
          x={SIDE_INSET}
          y={CANVAS_H - BOTTOM_INSET - BAR_THICKNESS}
          width={CANVAS_W * 0.32}
          height={BAR_THICKNESS}
          fill={match.home.flagPrimary}
        />
        <rect
          x={CANVAS_W - SIDE_INSET - CANVAS_W * 0.32}
          y={CANVAS_H - BOTTOM_INSET - BAR_THICKNESS}
          width={CANVAS_W * 0.32}
          height={BAR_THICKNESS}
          fill={match.away.flagPrimary}
        />

        {/* White pitch panel */}
        <rect
          x={PANEL.left}
          y={PANEL.top}
          width={PANEL_W}
          height={PANEL_H}
          fill="#FFFFFF"
        />

        {/* Goal animation host — foreignObject lets us drop the React
            tree (which mounts p5 inside it) directly into the SVG. */}
        <foreignObject
          x={PANEL.left}
          y={PANEL.top}
          width={PANEL_W}
          height={PANEL_H}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {children}
          </div>
        </foreignObject>

        {/* Score numerals — matches GridMatchCardWedgeBurst:
            cx = panel center, cy = midpoint of each team's half,
            FONT_SIZE 720, color = team flagPrimary, no outline. */}
        <text
          x={CANVAS_W / 2}
          y={PANEL.top + PANEL_H * 0.25}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight={900}
          fontSize={720}
          fill={match.home.flagPrimary}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {match.homeScore}
        </text>
        <text
          x={CANVAS_W / 2}
          y={PANEL.top + PANEL_H * 0.75}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight={900}
          fontSize={720}
          fill={match.away.flagPrimary}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {match.awayScore}
        </text>

        {/* Side captions — competition (left, rotated -90) and venue/date (right, +90). */}
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight={800}
          fontSize={42}
          letterSpacing="5"
          fill="#1A1A1A"
          transform={`translate(${SIDE_INSET / 2} ${CANVAS_H / 2}) rotate(-90)`}
        >
          {match.competition.toUpperCase()}
        </text>
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight={800}
          fontSize={42}
          letterSpacing="5"
          fill="#1A1A1A"
          transform={`translate(${CANVAS_W - SIDE_INSET / 2} ${CANVAS_H / 2}) rotate(90)`}
        >
          {`${match.venue} | ${match.date}`.toUpperCase()}
        </text>
      </svg>
    </div>
  );
};

const frameOuter: React.CSSProperties = {
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const cardSvg: React.CSSProperties = {
  aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
  height: "min(100%, calc(100vh - 140px))",
  background: "#F1EEE7",
  borderRadius: 8,
  boxShadow: "0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px #2a2a2e",
};
