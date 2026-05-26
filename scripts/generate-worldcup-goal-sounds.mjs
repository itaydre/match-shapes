// WC 2026 goal-yell generator
//
// Maps every team likely to play at the 2026 FIFA World Cup
// (USA / Canada / Mexico — host nations expanded to 48) to its
// commentator language, then asks ElevenLabs for a passionate goal
// shout in that language and post-processes the result to a clean
// 3-second MP3 ready to drop into public/audio/.
//
// Usage:
//   ELEVENLABS_API_KEY=sk-... node scripts/generate-worldcup-goal-sounds.mjs
//   # only regenerate a subset:
//   ELEVENLABS_API_KEY=sk-... node scripts/generate-worldcup-goal-sounds.mjs es fr ar
//   # force regenerate (overwrite existing files):
//   FORCE=1 ELEVENLABS_API_KEY=sk-... node scripts/generate-worldcup-goal-sounds.mjs
//
// Output: public/audio/goal-{lang}.mp3 — already-encoded 3 s clips
// with a fade-out tail so they don't clip into the next animation.
//
// Requires: node 18+ (global fetch), ffmpeg on PATH.

import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public/audio");
mkdirSync(OUT_DIR, { recursive: true });

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error("Set ELEVENLABS_API_KEY in env first.");
  process.exit(1);
}

const FORCE = process.env.FORCE === "1";
const FILTER = process.argv.slice(2); // optional: only generate these langs

// ─── Voice library ──────────────────────────────────────────────
// All voices below support `eleven_multilingual_v2`. Each one is
// energetic / broadcast-leaning so the goal yell carries through a
// 9 s stadium mix. Mix-and-match across languages for variety.
const VOICES = {
  adam: "pNInz6obpgDQGcFmaJgB", // English, deep & resonant
  antoni: "ErXwobaYiN019PkySvjV", // multi-lingual, warm
  josh: "TxGEqnHWrfWFTfGW9XjX", // English male, punchy
  chris: "iP95p4xoKVk53GoZ742B", // energetic broadcaster
  arnold: "VR6AewLTigWG4xSOukaG", // crisp male
  bill: "pqHfZKP75CvOlQylNhV4", // deep storyteller
};

// ─── Per-language phrase + voice ────────────────────────────────
// One entry per `goalLang` code used by any WC 2026 team. The same
// file backs every team that speaks that language — see TEAMS[]
// below for the team→lang mapping.
//
// Each phrase mirrors the actual catchphrase that language's
// broadcasters use when a goal is scored, not a generic shout. The
// note next to each line tracks the reference style; tweak as long
// as the cultural marker survives.
const LANG_ENTRIES = [
  {
    // English — typically the long "GOAL!" + a follow-up reaction
    // line ("What a goal!", "He's done it!", "Buried!").
    lang: "en",
    text: "GOOOOOOAAAL! What a goal! He's done it! Unbelievable!",
    voice: VOICES.josh,
    settings: { stability: 0.25, similarity_boost: 0.75, style: 0.8 },
  },
  {
    // Castilian / general Latin Spanish — TV-broadcast cadence with
    // long stretched vowels and an explosive country anchor.
    // Per user note: rhythmic, breath-stretched delivery.
    lang: "es",
    text: "GOOOOOOOOOOOOOOOOOOL DE ESPAÑAAAAA!!!",
    voice: VOICES.bill,
    settings: { stability: 0.1, similarity_boost: 0.85, style: 0.95 },
    duration: 2.7,
  },
  {
    // Argentinian Spanish — Andrés Cantor school: a single endless
    // "Gooool" yell, then a country-anchored repeat. Out-of-breath
    // cadence is the signature.
    lang: "es-ar",
    text: "Goooooooooooooooool! Gol! Gol! Gooool de Argentinaaaa!",
    voice: VOICES.antoni,
    settings: { stability: 0.15, similarity_boost: 0.72, style: 0.95 },
  },
  {
    // Mexican Spanish — same Cantor extension but anchored on "El
    // Tri" (the nickname for the México national team).
    lang: "es-mx",
    text: "Goooooooooool! Gol del TRI! Goool de Méxicooo! GOLAZO!",
    voice: VOICES.chris,
    settings: { stability: 0.18, similarity_boost: 0.72, style: 0.9 },
  },
  {
    // Brazilian Portuguese — Galvão Bueno school. Iconic long "ô"
    // followed by "GOLAÇO" (wonder-goal) and country anchor.
    lang: "br",
    text: "Goooooooooooool! GOLAÇO! Goooool do Brasiiiiil!",
    voice: VOICES.adam,
    settings: { stability: 0.18, similarity_boost: 0.75, style: 0.9 },
  },
  {
    // European Portuguese — authentic Portuguese broadcast: highly
    // melodic, emotional cadence, country anchored. Per user note,
    // we use "GOL" here (not "GOLO") to match the requested phrase.
    lang: "pt",
    text: "GOOOOOOOOOOOOOOOOOOL DE PORTUGAL!!!",
    voice: VOICES.bill,
    settings: { stability: 0.1, similarity_boost: 0.85, style: 0.95 },
    duration: 2.7,
  },
  {
    // French — authentic French TV style: elegant build then
    // explosive release, anchored on the country name.
    lang: "fr",
    text: "BUUUUUUUUUUUUUUUT POUR LA FRANCE!!!",
    voice: VOICES.chris,
    settings: { stability: 0.1, similarity_boost: 0.85, style: 0.95 },
    duration: 2.7,
  },
  {
    // German — "TOR!" + "Treffer!" (a hit/score) + "Was für ein
    // Tor!" reaction. Crisp, no over-extension.
    lang: "de",
    text: "TOOOOOR! TREFFER! Was für ein Tor!",
    voice: VOICES.arnold,
    settings: { stability: 0.3, similarity_boost: 0.7, style: 0.72 },
  },
  {
    // Italian — RAI-style commentary leans on "RETE!" (the net) as
    // the secondary word and "BOMBA!" for thunderbolts.
    lang: "it",
    text: "GOOOOOL! RETE! RETE! Che bomba! Magnifico gol!",
    voice: VOICES.chris,
    settings: { stability: 0.2, similarity_boost: 0.75, style: 0.85 },
  },
  {
    // Dutch — "DOELPUNT" is the formal word but commentators
    // routinely yell "GOAL!" too. "Schitterend!" = "splendid".
    lang: "nl",
    text: "DOELPUUUUUNT! Goal! Goal! Wat een schitterend doelpunt!",
    voice: VOICES.adam,
    settings: { stability: 0.28, similarity_boost: 0.75, style: 0.7 },
  },
  {
    // Croatian — "POGODAK" (a hit/score) is the distinctive word
    // alongside the more common "GOL". Sjajan = splendid.
    lang: "hr",
    text: "Goooool! POGODAK! POGODAK! Sjajan gol!",
    voice: VOICES.bill,
    settings: { stability: 0.25, similarity_boost: 0.75, style: 0.75 },
  },
  {
    // Arabic — Issam El Chawali / Khalil Al Balushi school. Pushed
    // hard for emotion: very low stability (0.10), very high style
    // (0.95) so the model abandons "newscaster" and goes full
    // stadium yell. Phrase builds via repeated extended "joool" plus
    // reaction interjections, then lands on ONE "hadaf" finisher
    // (per user note: don't double up on hadaf).
    //   GOOOAL! GOAL! GOAL! Oh my GOD! What a marvel! World-class
    //   GOAL!
    lang: "ar",
    text:
      "جوووووووول! جووول! جوول! يا اَللَّه! يَا لَلرَّوْعَة! هَدَفٌ عَالَمِيّ!",
    voice: VOICES.antoni,
    settings: { stability: 0.1, similarity_boost: 0.85, style: 0.95 },
  },
  {
    // Korean — KBS/MBC style: "골인!" (goal-in) and "환상적인
    // 골!" (fantastic goal) are signature lines.
    lang: "ko",
    text: "고오오오오올! 골인! 골인! 환상적인 골입니다!",
    voice: VOICES.chris,
    settings: { stability: 0.25, similarity_boost: 0.75, style: 0.85 },
  },
  {
    // Japanese — extended ゴォォォル + "決まった!" (it's in!) +
    // "やった!" (they did it!) is the typical NHK reaction string.
    lang: "jp",
    text: "ゴォォォォォール! 決まった! やった! 素晴らしいゴール!",
    voice: VOICES.antoni,
    settings: { stability: 0.25, similarity_boost: 0.75, style: 0.82 },
  },
  {
    // Persian (Farsi) — IRIB commentators stretch "گُل" with a
    // following reaction line, often "گُل تاریخی!" for historic
    // goals.
    lang: "fa",
    text: "گُل! گُل! گُل! چه گُل زیبایی! گُل تاریخی!",
    voice: VOICES.bill,
    settings: { stability: 0.28, similarity_boost: 0.75, style: 0.8 },
  },
  {
    // Turkish — TRT/Cine 5 broadcasters yell "GOL!" and "Ne gol
    // ama!" (what a goal!) plus "Muhteşem!" (magnificent).
    lang: "tr",
    text: "GOOOOOL! Gol! Ne gol ama! Muhteşem bir gol!",
    voice: VOICES.bill,
    settings: { stability: 0.25, similarity_boost: 0.75, style: 0.78 },
  },
  {
    // Swedish — SVT/TV4 leans on "MÅL!" + "Vilket mål!" (what a
    // goal!) with controlled intensity vs Spanish over-extension.
    lang: "sv",
    text: "MÅÅÅÅÅL! Mål! Mål! Vilket fantastiskt mål!",
    voice: VOICES.josh,
    settings: { stability: 0.3, similarity_boost: 0.75, style: 0.72 },
  },
  {
    // Norwegian — NRK style: "MÅL!" + "For et mål!" + "Stort mål!"
    // (big goal) sits between Swedish restraint and Latin passion.
    lang: "no",
    text: "MÅÅÅÅL! Mål! For et mål! Stort mål!",
    voice: VOICES.josh,
    settings: { stability: 0.3, similarity_boost: 0.75, style: 0.72 },
  },
  {
    // Danish — DR style: "MÅL!" + "Sikke et mål!" (such a goal!) +
    // "Vildt!" (wild/sick).
    lang: "da",
    text: "MÅÅÅÅL! Mål! Sikke et mål! Vildt mål!",
    voice: VOICES.bill,
    settings: { stability: 0.3, similarity_boost: 0.75, style: 0.72 },
  },
  {
    // Polish — TVP commentators yell "BRAMKA!" (literally "small
    // gate", the Polish word for goal) and "Cudowna bramka!"
    // (wonderful goal) + "Pięknie!" (beautifully).
    lang: "pl",
    text: "BRAMKAAAAA! Bramka! Cudowna bramka! Pięknie!",
    voice: VOICES.adam,
    settings: { stability: 0.28, similarity_boost: 0.75, style: 0.78 },
  },
  {
    // Uzbek — first-time qualifier in 2026. Model isn't officially
    // trained on Uzbek; phonemes work via Latin-script transliter-
    // ation. "Ajoyib" = excellent, "Zo'r" = great.
    lang: "uz",
    text: "GOOOOOOL! Goool! Ajoyib gol! Zo'r gol!",
    voice: VOICES.antoni,
    settings: { stability: 0.28, similarity_boost: 0.75, style: 0.78 },
  },
];

// ─── WC 2026 team → language ────────────────────────────────────
// Reference list (also exported below for the wider app). Used
// purely for the run-summary print at the end — the actual audio
// generation is per-language, since one MP3 backs every team that
// speaks that language.
const TEAMS = [
  // Hosts
  { code: "USA", name: "United States", lang: "en" },
  { code: "CAN", name: "Canada", lang: "en" },
  { code: "MEX", name: "Mexico", lang: "es-mx" },
  // UEFA (16)
  { code: "FRA", name: "France", lang: "fr" },
  { code: "ESP", name: "Spain", lang: "es" },
  { code: "GER", name: "Germany", lang: "de" },
  { code: "ENG", name: "England", lang: "en" },
  { code: "ITA", name: "Italy", lang: "it" },
  { code: "NED", name: "Netherlands", lang: "nl" },
  { code: "POR", name: "Portugal", lang: "pt" },
  { code: "CRO", name: "Croatia", lang: "hr" },
  { code: "BEL", name: "Belgium", lang: "nl" },
  { code: "SUI", name: "Switzerland", lang: "de" },
  { code: "DEN", name: "Denmark", lang: "da" },
  { code: "SWE", name: "Sweden", lang: "sv" },
  { code: "NOR", name: "Norway", lang: "no" },
  { code: "POL", name: "Poland", lang: "pl" },
  { code: "AUT", name: "Austria", lang: "de" },
  { code: "TUR", name: "Türkiye", lang: "tr" },
  // Russia is currently suspended from FIFA competitions; not in WC 2026.
  // CONMEBOL (6)
  { code: "ARG", name: "Argentina", lang: "es-ar" },
  { code: "BRA", name: "Brazil", lang: "br" },
  { code: "URU", name: "Uruguay", lang: "es" },
  { code: "COL", name: "Colombia", lang: "es" },
  { code: "ECU", name: "Ecuador", lang: "es" },
  { code: "PAR", name: "Paraguay", lang: "es" },
  // CAF (9)
  { code: "MAR", name: "Morocco", lang: "ar" },
  { code: "SEN", name: "Senegal", lang: "fr" },
  { code: "TUN", name: "Tunisia", lang: "ar" },
  { code: "EGY", name: "Egypt", lang: "ar" },
  { code: "ALG", name: "Algeria", lang: "ar" },
  { code: "NGA", name: "Nigeria", lang: "en" },
  { code: "GHA", name: "Ghana", lang: "en" },
  { code: "CIV", name: "Ivory Coast", lang: "fr" },
  { code: "CMR", name: "Cameroon", lang: "fr" },
  { code: "RSA", name: "South Africa", lang: "en" },
  // AFC (8)
  { code: "JPN", name: "Japan", lang: "jp" },
  { code: "KOR", name: "South Korea", lang: "ko" },
  { code: "IRN", name: "Iran", lang: "fa" },
  { code: "KSA", name: "Saudi Arabia", lang: "ar" },
  { code: "AUS", name: "Australia", lang: "en" },
  { code: "QAT", name: "Qatar", lang: "ar" },
  { code: "UAE", name: "UAE", lang: "ar" },
  { code: "UZB", name: "Uzbekistan", lang: "uz" },
  // CONCACAF (3 + hosts above)
  { code: "CRC", name: "Costa Rica", lang: "es" },
  { code: "JAM", name: "Jamaica", lang: "en" },
  { code: "PAN", name: "Panama", lang: "es" },
  // OFC (1)
  { code: "NZL", name: "New Zealand", lang: "en" },
];

// ─── ElevenLabs call ────────────────────────────────────────────
const MODEL = "eleven_multilingual_v2";

const requestAudio = async (text, voiceId, settings) => {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        voice_settings: {
          stability: settings.stability ?? 0.3,
          similarity_boost: settings.similarity_boost ?? 0.75,
          style: settings.style ?? 0.6,
          use_speaker_boost: true,
        },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 400)}`);
  }
  return Buffer.from(await res.arrayBuffer());
};

// ─── ffmpeg post-process ────────────────────────────────────────
// Trims to the entry's `duration` (default 3.0 s), applies a
// short fade-out tail and a loudness ceiling so the clip can sit
// on top of the crowd loop without clipping. Normalises to 192
// kbps MP3.
const postProcess = (rawPath, finalPath, duration = 3.0) => {
  const fadeStart = Math.max(0, duration - 0.4);
  const args = [
    "-y",
    "-i", rawPath,
    "-t", duration.toFixed(2),
    "-af",
    `afade=t=out:st=${fadeStart.toFixed(2)}:d=0.4,alimiter=limit=0.97:level=disabled`,
    "-b:a", "192k",
    "-ar", "44100",
    finalPath,
  ];
  const out = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (out.status !== 0) {
    throw new Error(`ffmpeg failed: ${out.stderr.split("\n").slice(-5).join("\n")}`);
  }
};

// ─── Main loop ──────────────────────────────────────────────────
const summary = [];
for (const entry of LANG_ENTRIES) {
  if (FILTER.length > 0 && !FILTER.includes(entry.lang)) continue;
  const finalPath = resolve(OUT_DIR, `goal-${entry.lang}.mp3`);
  if (existsSync(finalPath) && !FORCE) {
    console.log(`SKIP  goal-${entry.lang}.mp3 (exists — pass FORCE=1 to overwrite)`);
    summary.push({ lang: entry.lang, status: "skip" });
    continue;
  }
  process.stdout.write(`→ goal-${entry.lang}.mp3 ... `);
  const rawPath = resolve(OUT_DIR, `goal-${entry.lang}.raw.mp3`);
  try {
    const buf = await requestAudio(entry.text, entry.voice, entry.settings);
    writeFileSync(rawPath, buf);
    postProcess(rawPath, finalPath, entry.duration ?? 3.0);
    unlinkSync(rawPath);
    console.log(`OK (${(buf.byteLength / 1024).toFixed(1)} KB → 3 s)`);
    summary.push({ lang: entry.lang, status: "ok" });
  } catch (err) {
    console.log(`FAIL: ${err.message}`);
    summary.push({ lang: entry.lang, status: "fail", err: err.message });
  }
}

// ─── Run summary ────────────────────────────────────────────────
console.log("\n─── Run summary ───");
const ok = summary.filter((s) => s.status === "ok").length;
const skip = summary.filter((s) => s.status === "skip").length;
const fail = summary.filter((s) => s.status === "fail").length;
console.log(`  ✓ ${ok} generated, ${skip} skipped, ${fail} failed`);

// Per-team coverage report — flags any team whose language we
// don't have an entry for (good early-warning for future
// qualifications).
const langsWithEntries = new Set(LANG_ENTRIES.map((e) => e.lang));
const missing = TEAMS.filter((t) => !langsWithEntries.has(t.lang));
if (missing.length > 0) {
  console.log(`\n!  ${missing.length} teams have no language entry:`);
  for (const t of missing) {
    console.log(`     ${t.code}  ${t.name}  (lang=${t.lang})`);
  }
} else {
  console.log("\n  All 48 WC 2026 teams are covered.");
}

console.log("\nFiles in", OUT_DIR);
