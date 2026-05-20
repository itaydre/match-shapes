// ─────────────────────────────────────────────────────────────────────
// Match audio — crowd-loop + per-goal commentator yells. Browser-only
// (uses the Audio element). Asset files ship in this repo under
// assets/audio/; the host app must serve them and point `audioBaseUrl`
// at the served directory (default "/audio").
// ─────────────────────────────────────────────────────────────────────

// Map of goal-language tag → filename (relative to audioBaseUrl).
// Most are dedicated commentator yells; a missing lang falls back to
// goal-<lang>.mp3.
export const GOAL_AUDIO: Record<string, string> = {
  br: "goal-br.wav",
  ko: "goal-ko.wav",
  jp: "goal-jp.wav",
  fa: "goal-fa.wav",
  "es-ar": "goal-es-ar.wav",
  "ar-sa": "goal-ar-sa.wav",
  hr: "goal-hr.wav",
  nl: "goal-nl.wav",
  pt: "goal-pt.wav",
  "nl-be": "goal-nl-be.wav",
  "de-at": "goal-de-at.wav",
  uz: "goal-uz.wav",
  en: "goal-en.wav",
  "ar-eg": "goal-ar-eg.wav",
  "ar-iq": "goal-ar-iq.wav",
  "ar-jo": "goal-ar-jo.wav",
  "ar-qa": "goal-ar-qa.wav",
  "ar-ma": "goal-ar-ma.wav",
  "en-ca": "goal-en-ca.wav",
  "en-jm": "goal-en-jm.wav",
  "en-sct": "goal-en-sct.wav",
  "ar-dz": "goal-ar-dz.wav",
};

const join = (base: string, file: string) =>
  `${base.replace(/\/$/, "")}/${file}`;

// Resolve a full URL for a team's goal-language yell.
export const goalAudioPath = (lang: string, audioBaseUrl = "/audio"): string => {
  const file = GOAL_AUDIO[lang] ?? `goal-${lang}.mp3`;
  return join(audioBaseUrl, file);
};

export type MatchAudioOptions = {
  // Directory the audio files are served from (default "/audio").
  audioBaseUrl?: string;
  // 0..1 crowd-loop volume (default 0.9).
  crowdVolume?: number;
  // 0..1 goal-yell volume (default 0.7).
  goalVolume?: number;
};

// Tiny stateful controller for one match playthrough. Construct once,
// call `startCrowd()` at kickoff, `fireGoal(lang)` when a goal lands
// (it de-dupes by goal id if you pass one), and `stop()` on teardown.
//
//   const audio = new MatchAudio({ audioBaseUrl: "/audio" });
//   audio.startCrowd();
//   // when a goal triggers:
//   audio.fireGoal("jp", goal.id);
//   // on unmount:
//   audio.stop();
export class MatchAudio {
  private base: string;
  private crowdVol: number;
  private goalVol: number;
  private crowd: HTMLAudioElement | null = null;
  private fired = new Set<string>();

  constructor(opts: MatchAudioOptions = {}) {
    this.base = opts.audioBaseUrl ?? "/audio";
    this.crowdVol = opts.crowdVolume ?? 0.9;
    this.goalVol = opts.goalVolume ?? 0.7;
  }

  startCrowd(): void {
    if (typeof Audio === "undefined") return;
    if (this.crowd) return;
    const c = new Audio(join(this.base, "crowd.mp3"));
    c.loop = true;
    c.volume = this.crowdVol;
    c.play().catch(() => {});
    this.crowd = c;
  }

  setCrowdVolume(v: number): void {
    this.crowdVol = v;
    if (this.crowd) this.crowd.volume = v;
  }

  // Play a goal yell. Pass a unique key (goal id) to ensure it only
  // fires once even if called every frame.
  fireGoal(lang: string, key?: string): void {
    if (typeof Audio === "undefined") return;
    if (key !== undefined) {
      if (this.fired.has(key)) return;
      this.fired.add(key);
    }
    const a = new Audio(goalAudioPath(lang, this.base));
    a.volume = this.goalVol;
    a.play().catch(() => {});
  }

  playWhistle(): void {
    if (typeof Audio === "undefined") return;
    const w = new Audio(join(this.base, "whistle.mp3"));
    w.volume = this.goalVol;
    w.play().catch(() => {});
  }

  // Reset the per-goal de-dupe set (e.g. when replaying the match).
  reset(): void {
    this.fired.clear();
  }

  stop(): void {
    if (this.crowd) {
      this.crowd.pause();
      this.crowd.src = "";
      this.crowd = null;
    }
    this.fired.clear();
  }
}
