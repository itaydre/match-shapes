import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadRobotoFlex } from "@remotion/google-fonts/RobotoFlex";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { StaticPreviewV3 } from "../playground/StaticPreviewV3";
import {
  GAMES,
  MATCH_CONTEXTS,
  DEFAULT_MATCH_CONTEXT,
  v1BuildFamilyMap,
} from "../playground/GameGallery";
import { computeGoalImportance } from "../src/lib/goalImportance";

// The lab pulls these via a Google Fonts <link>; Remotion has no such
// link, so register them here. loadFont() adds the @font-face and uses
// delayRender under the hood, so frames aren't captured before the
// fonts are ready (no flash of fallback text). The giant score numerals
// use Sharp Grotesk VF, which StaticPreviewV3 embeds itself (base64).
// Trim weights/subsets to only what the card uses — otherwise Inter
// alone fires 100+ font requests per render. Anton is single-weight;
// Roboto Flex is variable; Inter is only a fallback in the stacks.
loadAnton("normal", { subsets: ["latin"] });
loadRobotoFlex("normal", { subsets: ["latin"] });
loadInter("normal", {
  weights: ["400", "700", "900"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});

// 30fps matches the timing constants authored in showcaseShapes
// (STAGGER_TOTAL/PER_CELL are frame counts at 30fps). 270 frames = the
// same total the existing Puppeteer renderer (render-match.mjs) uses.
export const MATCH_FPS = 30;
export const MATCH_DURATION = 270;

export type MatchVideoProps = { matchId: string };

export const MatchVideo: React.FC<MatchVideoProps> = ({ matchId }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Same derivation GalleryCard / RenderMatch feed StaticPreviewV3, so
  // the video matches the gallery exactly (family shuffle + importance).
  const game = useMemo(
    () => GAMES.find((g) => g.id === matchId) ?? GAMES[0]!,
    [matchId],
  );
  const familyMap = useMemo(
    () => v1BuildFamilyMap(game.id, game.goals),
    [game],
  );
  const importanceById = useMemo(() => {
    const ctx = MATCH_CONTEXTS[game.id] ?? DEFAULT_MATCH_CONTEXT;
    const map = new Map<string, number>();
    for (const g of game.goals) {
      const b = computeGoalImportance(
        { id: g.id, team: g.team, minute: g.minute },
        game.goals.map((x) => ({ id: x.id, team: x.team, minute: x.minute })),
        ctx,
      );
      map.set(g.id, b.importance);
    }
    return map;
  }, [game]);
  const underdog: "home" | "away" = useMemo(() => {
    const ctx = MATCH_CONTEXTS[game.id] ?? DEFAULT_MATCH_CONTEXT;
    return ctx.homeStrength <= ctx.awayStrength ? "home" : "away";
  }, [game]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#F4F4F4" }}>
      {/* deterministic → each goal's reveal is SEEKED to (frame -
          triggerFrame)/fps, so the whole card is a pure function of the
          Remotion frame. No rAF, no GSAP wall-clock. */}
      <StaticPreviewV3
        goals={game.goals}
        frame={frame}
        home={game.home}
        away={game.away}
        competition={game.competition}
        venueAndDate={game.venueAndDate}
        finalHomePossession={game.finalHomePossession}
        events={game.events}
        importanceById={importanceById}
        showLabelWell={false}
        familyForGoal={(g) => familyMap.get(g.id)!}
        underdog={underdog}
        deterministic
      />

      {/* Crowd ambience under the whole clip. */}
      <Audio src={staticFile("audio/crowd.mp3")} volume={0.25} loop />
      {/* Final whistle ~1s before the end. */}
      <Sequence from={Math.max(0, durationInFrames - fps)}>
        <Audio src={staticFile("audio/whistle.mp3")} />
      </Sequence>
    </AbsoluteFill>
  );
};
