import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { matchCardSchema, MatchCardProps } from "./schema";
import { fonts, palette, CANVAS_W, CANVAS_H } from "./lib/theme";
import {
  KICKOFF_END,
  MATCH_END,
  minuteToFrame,
} from "./lib/timing";
import { possessionAtFrame, possessionToMidpoint } from "./lib/possession";
import { BaseLayout, PANEL_BOUNDS } from "./components/BaseLayout";
import { Midline } from "./components/Midline";
import { ScoreNumeral, ScoreFlare } from "./components/ScoreNumeral";
import { GoalArt, DramaticFlash } from "./components/GoalArt";
import { TeamGrid, cellRect, cellCount } from "./components/TeamGrid";
import { goalWeight } from "./lib/goalWeight";
import { MatchEvents } from "./components/MatchEvents";
import { EventLegend } from "./components/EventLegend";

export { matchCardSchema };

export const MatchCard: React.FC<MatchCardProps> = (props) => {
  const {
    home,
    away,
    competition,
    venue,
    date,
    goals,
    possessionTimeline,
    emotion,
    clash,
    shotDensity,
    showGrid,
    showShots,
  } = props;

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Midpoint position --------------------------------------------------------
  const homeShareNow = possessionAtFrame(frame, possessionTimeline);
  const midFrac = possessionToMidpoint(homeShareNow);
  const midY = PANEL_BOUNDS.top + midFrac * PANEL_BOUNDS.height;

  // Goal sequencing + drama weight ------------------------------------------
  const homeGoals = goals.filter((g) => g.team === "home");
  const awayGoals = goals.filter((g) => g.team === "away");
  const homeGoalEvents = homeGoals
    .map((g, idx) => ({
      ...g,
      count: idx + 1,
      frame: minuteToFrame(g.minute),
      weight: goalWeight(g, goals),
    }))
    .sort((a, b) => a.frame - b.frame);
  const awayGoalEvents = awayGoals
    .map((g, idx) => ({
      ...g,
      count: idx + 1,
      frame: minuteToFrame(g.minute),
      weight: goalWeight(g, goals),
    }))
    .sort((a, b) => a.frame - b.frame);

  const homeScoreNow = homeGoalEvents.filter((g) => frame >= g.frame).length;
  const awayScoreNow = awayGoalEvents.filter((g) => frame >= g.frame).length;
  const lastHomeBump =
    [...homeGoalEvents].reverse().find((g) => frame >= g.frame)?.frame ?? -999;
  const lastAwayBump =
    [...awayGoalEvents].reverse().find((g) => frame >= g.frame)?.frame ?? -999;

  // Bounds for each team's half (driven by the midline) ---------------------
  const topBounds = {
    left: PANEL_BOUNDS.left + 24,
    top: PANEL_BOUNDS.top + 24,
    width: PANEL_BOUNDS.width - 48,
    height: midY - PANEL_BOUNDS.top - 24,
  };
  const bottomBounds = {
    left: PANEL_BOUNDS.left + 24,
    top: midY + 24,
    width: PANEL_BOUNDS.width - 48,
    height: PANEL_BOUNDS.bottom - midY - 24,
  };

  // Final-state hold flourish (last 30 frames): tiny "settle" bounce -------
  const finaleEnter = spring({
    frame: frame - MATCH_END,
    fps,
    config: { damping: 18, stiffness: 110 },
    durationInFrames: 30,
  });

  const cx = (PANEL_BOUNDS.left + PANEL_BOUNDS.right) / 2;

  return (
    <AbsoluteFill style={{ background: palette.bg }}>
      <BaseLayout
        home={home}
        away={away}
        competition={competition}
        venue={venue}
        date={date}
      />

      {/* Midline + kickoff circle */}
      <div
        style={{
          position: "absolute",
          left: PANEL_BOUNDS.left,
          top: 0,
          width: PANEL_BOUNDS.width,
          height: CANVAS_H,
        }}
      >
        <Midline y={midY} width={PANEL_BOUNDS.width} />
      </div>

      {/* Per-team grids (toggleable) */}
      <TeamGrid bounds={topBounds} visible={showGrid} color={home.flagPrimary} />
      <TeamGrid
        bounds={bottomBounds}
        visible={showGrid}
        color={away.flagPrimary}
      />

      {/* Match events scatter (above grid, below numerals) */}
      <MatchEvents
        bounds={{
          left: PANEL_BOUNDS.left,
          top: PANEL_BOUNDS.top,
          width: PANEL_BOUNDS.width,
          height: PANEL_BOUNDS.height,
        }}
        midY={midY}
        home={home}
        away={away}
        density={shotDensity}
        endFrame={MATCH_END - 30}
        show={showShots}
      />

      {/* Score flares — radial bursts behind the digits at score moments */}
      {homeGoalEvents.map((g, i) => (
        <ScoreFlare
          key={`hflare-${i}`}
          cx={cx}
          cy={(PANEL_BOUNDS.top + midY) / 2}
          color={home.flagPrimary}
          triggerFrame={g.frame}
        />
      ))}
      {awayGoalEvents.map((g, i) => (
        <ScoreFlare
          key={`aflare-${i}`}
          cx={cx}
          cy={(midY + PANEL_BOUNDS.bottom) / 2}
          color={away.flagPrimary}
          triggerFrame={g.frame}
        />
      ))}

      {/* Score numerals — rendered BEFORE goal art so the artworks layer over them */}
      <ScoreNumeral
        value={homeScoreNow}
        color={home.flagPrimary}
        cx={cx}
        cy={(PANEL_BOUNDS.top + midY) / 2}
        bumpFrame={lastHomeBump}
      />
      <ScoreNumeral
        value={awayScoreNow}
        color={away.flagPrimary}
        cx={cx}
        cy={(midY + PANEL_BOUNDS.bottom) / 2}
        bumpFrame={lastAwayBump}
      />

      {/* Goal artworks — layered ON TOP of the numerals via mixBlendMode multiply.
          Clipped to the panel (the pitch) so the dramatic-sized shapes don't
          spill into the side captions. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: `inset(${PANEL_BOUNDS.top}px ${
            CANVAS_W - PANEL_BOUNDS.right
          }px ${CANVAS_H - PANEL_BOUNDS.bottom}px ${PANEL_BOUNDS.left}px)`,
          pointerEvents: "none",
        }}
      >
        {homeGoalEvents.map((g, i) => {
          const cell = g.cell ?? defaultHomeCell(i);
          const rect = cellRect(cell, topBounds);
          return (
            <GoalArt
              key={`h-${i}`}
              rect={rect}
              team={home}
              opponentColor={away.flagPrimary}
              style={g.style}
              triggerFrame={g.frame}
              emotion={emotion}
              clash={clash}
              weight={g.weight}
            />
          );
        })}
        {awayGoalEvents.map((g, i) => {
          const cell = g.cell ?? defaultAwayCell(i);
          const rect = cellRect(cell, bottomBounds);
          return (
            <GoalArt
              key={`a-${i}`}
              rect={rect}
              team={away}
              opponentColor={home.flagPrimary}
              style={g.style}
              triggerFrame={g.frame}
              emotion={emotion}
              clash={clash}
              weight={g.weight}
            />
          );
        })}
      </div>

      {/* Drama flashes for high-weight goals — fullscreen color tint on impact */}
      {[...homeGoalEvents, ...awayGoalEvents].map((g, i) => (
        <DramaticFlash
          key={`flash-${i}`}
          triggerFrame={g.frame}
          color={g.team === "home" ? home.flagPrimary : away.flagPrimary}
          weight={g.weight}
        />
      ))}

      {/* Goal minute tags — show "MM'" pill at each goal's cell */}
      {homeGoalEvents.map((g, i) => {
        const cell = g.cell ?? defaultHomeCell(i);
        const rect = cellRect(cell, topBounds);
        return (
          <GoalMinuteTag
            key={`hmin-${i}`}
            minute={g.minute}
            rect={rect}
            color={home.flagPrimary}
            triggerFrame={g.frame}
          />
        );
      })}
      {awayGoalEvents.map((g, i) => {
        const cell = g.cell ?? defaultAwayCell(i);
        const rect = cellRect(cell, bottomBounds);
        return (
          <GoalMinuteTag
            key={`amin-${i}`}
            minute={g.minute}
            rect={rect}
            color={away.flagPrimary}
            triggerFrame={g.frame}
          />
        );
      })}

      {/* Bottom legend */}
      {showShots ? (
        <EventLegend
          bottom={146}
          left={PANEL_BOUNDS.left + 12}
          startFrame={KICKOFF_END + 30}
        />
      ) : null}

      {/* Final-state veil flourish — a brief flash that settles into the last frame */}
      <FinaleFlash progress={finaleEnter} />

      {/* "Live minute" tick caption — small, animates with timeline */}
      <MinuteTick frame={frame} cx={cx} midY={midY} />
    </AbsoluteFill>
  );
};

const defaultHomeCell = (i: number) => {
  // Spread England's first three goals across upper-left, upper-right, mid-right cells.
  const slots = [0, 4, 9, 14, 1, 5];
  return slots[i % slots.length] ?? (i * 3) % cellCount;
};
const defaultAwayCell = (i: number) => {
  const slots = [14, 9, 18, 5, 11, 3];
  return slots[i % slots.length] ?? (i * 5) % cellCount;
};

const FinaleFlash: React.FC<{ progress: number }> = ({ progress }) => {
  if (progress <= 0) return null;
  const o = interpolate(progress, [0, 0.4, 1], [0.18, 0.06, 0], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        background: "white",
        opacity: o,
        pointerEvents: "none",
      }}
    />
  );
};

/**
 * Minute pill that fades in at a goal's trigger frame and stays for the rest
 * of the video. Anchored to the top-left of the goal's original cell so it
 * sits at a stable, predictable position even as the goal art around it grows.
 * White-pill + team-color stroke keeps it readable against the busy artwork.
 */
const GoalMinuteTag: React.FC<{
  minute: number;
  rect: { x: number; y: number; w: number; h: number };
  color: string;
  triggerFrame: number;
}> = ({ minute, rect, color, triggerFrame }) => {
  const frame = useCurrentFrame();
  const local = frame - triggerFrame;
  if (local < 0) return null;
  const o = interpolate(local, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Slide-in: tag enters from above its final position.
  const slide = interpolate(local, [0, 18], [-12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: rect.x + 8,
        top: rect.y + 8,
        padding: "6px 12px",
        background: "#FFFFFF",
        border: `2px solid ${color}`,
        fontFamily: fonts.body,
        fontWeight: 900,
        fontSize: 26,
        letterSpacing: 1.5,
        color,
        opacity: o,
        transform: `translateY(${slide}px)`,
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      {minute}&apos;
    </div>
  );
};

const MinuteTick: React.FC<{ frame: number; cx: number; midY: number }> = ({
  frame,
  cx,
  midY,
}) => {
  if (frame < KICKOFF_END) return null;
  const minute = Math.min(
    90,
    Math.round(((frame - KICKOFF_END) / (MATCH_END - KICKOFF_END)) * 90),
  );
  const o = interpolate(frame, [KICKOFF_END, KICKOFF_END + 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: midY - 30,
        transform: "translate(-50%, -100%)",
        fontFamily: fonts.body,
        fontWeight: 700,
        fontSize: 14,
        letterSpacing: 3,
        color: palette.ink,
        opacity: 0.45 * o,
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      {minute}'
    </div>
  );
};

