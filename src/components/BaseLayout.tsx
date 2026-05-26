import React from "react";
import { AbsoluteFill } from "remotion";
import { fonts, palette, CANVAS_W, CANVAS_H } from "../lib/theme";
import type { Team } from "../schema";

type Props = {
  home: Team;
  away: Team;
  competition: string;
  venue: string;
  date: string;
};

// Wide enough to accommodate the rotated side captions OUTSIDE the pitch.
const SIDE_INSET = 96;
const TOP_INSET = 140;
const BOTTOM_INSET = 140;

const SIDE_CAPTION_FONT_SIZE = 42;

export const BaseLayout: React.FC<Props> = ({
  home,
  away,
  competition,
  venue,
  date,
}) => {
  return (
    <AbsoluteFill style={{ background: palette.bg }}>
      {/* Team labels --------------------------------------------------- */}
      <div
        style={{
          position: "absolute",
          top: 36,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: fonts.body,
          fontWeight: 900,
          fontSize: 72,
          letterSpacing: 4,
          color: "#0E0E0E",
        }}
      >
        {home.name.toUpperCase()}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 36,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: fonts.body,
          fontWeight: 900,
          fontSize: 72,
          letterSpacing: 4,
          color: "#0E0E0E",
        }}
      >
        {away.name.toUpperCase()}
      </div>

      {/* Top color bars — home team's full tricolor (primary | secondary
          | accent) stretched edge-to-edge between the side insets,
          mirroring the away strip below. For 2-colour teams (e.g.
          England, where primary == accent) the centre stripe just
          becomes a second slot of the primary colour — a small visual
          change but the layout stays symmetric with away. */}
      <div
        style={{
          position: "absolute",
          top: TOP_INSET,
          left: SIDE_INSET,
          width: `calc((100% - ${SIDE_INSET * 2}px) / 3)`,
          height: 14,
          background: home.flagPrimary,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: TOP_INSET,
          left: `calc(${SIDE_INSET}px + (100% - ${SIDE_INSET * 2}px) / 3)`,
          width: `calc((100% - ${SIDE_INSET * 2}px) / 3)`,
          height: 14,
          background: home.flagSecondary,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: TOP_INSET,
          right: SIDE_INSET,
          width: `calc((100% - ${SIDE_INSET * 2}px) / 3)`,
          height: 14,
          background: home.flagAccent,
        }}
      />

      {/* Bottom bars — Brazil flag triplet (green | yellow | blue)
          stretched edge-to-edge between the side insets. Each colour
          claims a third of the available width. */}
      <div
        style={{
          position: "absolute",
          bottom: BOTTOM_INSET,
          left: SIDE_INSET,
          width: `calc((100% - ${SIDE_INSET * 2}px) / 3)`,
          height: 14,
          background: away.flagPrimary,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: BOTTOM_INSET,
          left: `calc(${SIDE_INSET}px + (100% - ${SIDE_INSET * 2}px) / 3)`,
          width: `calc((100% - ${SIDE_INSET * 2}px) / 3)`,
          height: 14,
          background: away.flagSecondary,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: BOTTOM_INSET,
          right: SIDE_INSET,
          width: `calc((100% - ${SIDE_INSET * 2}px) / 3)`,
          height: 14,
          background: away.flagAccent,
        }}
      />

      {/* Inner panel (the pitch) --------------------------------------- */}
      <div
        style={{
          position: "absolute",
          top: TOP_INSET + 14,
          bottom: BOTTOM_INSET + 14,
          left: SIDE_INSET,
          right: SIDE_INSET,
          background: palette.panel,
          overflow: "hidden",
        }}
      />

      {/* Side captions — OUTSIDE the pitch, in the beige strip ------- */}
      <SideCaption side="left" text={competition} />
      <SideCaption side="right" text={`${venue} | ${date}`} />

      {/* Outer thin frame for the whole card */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          border: `1px solid rgba(20,20,20,0.04)`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

const SideCaption: React.FC<{ side: "left" | "right"; text: string }> = ({
  side,
  text,
}) => {
  // The caption sits CENTERED inside the beige strip on either side. We rotate
  // around the (left, top: 50%) anchor so both sides remain perfectly mirrored.
  const stripCenterX = SIDE_INSET / 2;
  const common: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    fontFamily: fonts.body,
    fontWeight: 800,
    fontSize: SIDE_CAPTION_FONT_SIZE,
    letterSpacing: 5,
    color: palette.ink,
    whiteSpace: "nowrap",
    transformOrigin: "center",
  };
  if (side === "left") {
    return (
      <div
        style={{
          ...common,
          left: stripCenterX,
          transform: "translate(-50%, -50%) rotate(-90deg)",
        }}
      >
        {text.toUpperCase()}
      </div>
    );
  }
  return (
    <div
      style={{
        ...common,
        right: stripCenterX,
        transform: "translate(50%, -50%) rotate(90deg)",
      }}
    >
      {text.toUpperCase()}
    </div>
  );
};

export const PANEL_BOUNDS = {
  top: TOP_INSET + 14,
  bottom: CANVAS_H - (BOTTOM_INSET + 14),
  left: SIDE_INSET,
  right: CANVAS_W - SIDE_INSET,
  width: CANVAS_W - 2 * SIDE_INSET,
  get height() {
    return this.bottom - this.top;
  },
};
