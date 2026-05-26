// One-shot generator: pulls an enthusiastic "GOAAAL" yell from
// ElevenLabs in every language the gallery needs.
//
// Usage:
//   ELEVENLABS_API_KEY=sk-... node scripts/generate-goal-sounds.mjs
//
// Output: public/audio/goal-{lang}.mp3 for each entry below. Skips a
// language if its file already exists (delete the file to regenerate).

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public/audio");
mkdirSync(OUT_DIR, { recursive: true });

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error("Set ELEVENLABS_API_KEY in env first.");
  process.exit(1);
}

// Voice IDs from the public ElevenLabs voice library. Each voice
// supports the eleven_multilingual_v2 model, so the same voice can
// be re-used across languages — but giving each language its OWN
// voice produces more variety. Tweak to taste.
const VOICES = {
  // Energetic male — fits passionate broadcasters.
  adam: "pNInz6obpgDQGcFmaJgB", // English, deep & resonant
  antoni: "ErXwobaYiN019PkySvjV", // multi-lingual, warm
  josh: "TxGEqnHWrfWFTfGW9XjX", // English male
  chris: "iP95p4xoKVk53GoZ742B", // energetic
  arnold: "VR6AewLTigWG4xSOukaG", // crisp male
  bill: "pqHfZKP75CvOlQylNhV4", // deep storyteller
};

// One row per language: filename, phrase, voice, optional voice
// settings (stability + similarity boost). Lower stability =
// more emotional/varied; higher = more consistent / news-style.
const ENTRIES = [
  {
    file: "goal-br.mp3", // Brazilian Portuguese
    text: "Gooooooool! Goool! Goooooool!",
    voice: VOICES.adam,
    settings: { stability: 0.22, similarity_boost: 0.75, style: 0.8 },
  },
  {
    file: "goal-pt.mp3", // European Portuguese
    text: "Goooooooool! Gol! Gol! Goooool!",
    voice: VOICES.antoni,
    settings: { stability: 0.25, similarity_boost: 0.75, style: 0.7 },
  },
  {
    file: "goal-es.mp3", // Spanish (LatAm / castilian — both work)
    text: "Goooooooooooool! Gooooooool!",
    voice: VOICES.bill,
    settings: { stability: 0.18, similarity_boost: 0.7, style: 0.9 },
  },
  {
    file: "goal-fr.mp3", // French
    text: "BUUUUUT! BUUUUUT! Magnifique buuut!",
    voice: VOICES.josh,
    settings: { stability: 0.3, similarity_boost: 0.75, style: 0.7 },
  },
  {
    file: "goal-de.mp3", // German
    text: "TOOOOOR! TOOOOR! Was für ein Tor!",
    voice: VOICES.arnold,
    settings: { stability: 0.3, similarity_boost: 0.7, style: 0.65 },
  },
  {
    file: "goal-it.mp3", // Italian
    text: "GOOOOOOOL! Goool! Gol! Magnifico gol!",
    voice: VOICES.chris,
    settings: { stability: 0.2, similarity_boost: 0.75, style: 0.8 },
  },
  {
    file: "goal-nl.mp3", // Dutch
    text: "DOELPUUUUUNT! Doelpunt! Wat een doelpunt!",
    voice: VOICES.adam,
    settings: { stability: 0.3, similarity_boost: 0.75, style: 0.6 },
  },
  {
    file: "goal-en.mp3", // English
    text: "GOOOOOOAAAL! What a goal! GOOOOAAAL!",
    voice: VOICES.josh,
    settings: { stability: 0.25, similarity_boost: 0.75, style: 0.75 },
  },
  {
    file: "goal-hr.mp3", // Croatian
    text: "Goooool! Gol! Gol! Goooooool!",
    voice: VOICES.bill,
    settings: { stability: 0.25, similarity_boost: 0.75, style: 0.7 },
  },
  {
    file: "goal-ar.mp3", // Arabic (KSA, Qatar, Egypt, Jordan, Morocco)
    text: "هدف! هدف! هدف! يا للروعة، هدف رائع!",
    voice: VOICES.adam,
    settings: { stability: 0.3, similarity_boost: 0.75, style: 0.75 },
  },
  {
    file: "goal-ko.mp3", // Korean (South Korea)
    text: "고오오오오올! 골! 골! 굉장한 골!",
    voice: VOICES.chris,
    settings: { stability: 0.25, similarity_boost: 0.75, style: 0.8 },
  },
  {
    file: "goal-tr.mp3", // Turkish
    text: "GOOOOOL! Gol! Muhteşem bir gol!",
    voice: VOICES.bill,
    settings: { stability: 0.25, similarity_boost: 0.75, style: 0.75 },
  },
  {
    file: "goal-sv.mp3", // Swedish
    text: "MÅÅÅÅÅL! Mål! Mål! Vilket mål!",
    voice: VOICES.josh,
    settings: { stability: 0.3, similarity_boost: 0.75, style: 0.7 },
  },
  {
    file: "goal-pl.mp3", // Polish
    text: "BRAMKAAAAA! Bramka! Cudowna bramka!",
    voice: VOICES.adam,
    settings: { stability: 0.28, similarity_boost: 0.75, style: 0.75 },
  },
  {
    file: "goal-no.mp3", // Norwegian
    text: "MÅÅÅÅL! Mål! Mål! For et mål!",
    voice: VOICES.josh,
    settings: { stability: 0.3, similarity_boost: 0.75, style: 0.7 },
  },
  {
    file: "goal-da.mp3", // Danish
    text: "MÅÅÅÅL! Mål! Mål! Sikke et mål!",
    voice: VOICES.bill,
    settings: { stability: 0.3, similarity_boost: 0.75, style: 0.7 },
  },
  {
    file: "goal-ru.mp3", // Russian
    text: "ГОООООЛ! ГОЛ! ГОЛ! Какой гол!",
    voice: VOICES.arnold,
    settings: { stability: 0.28, similarity_boost: 0.75, style: 0.78 },
  },
];

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
          style: settings.style ?? 0.5,
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

for (const entry of ENTRIES) {
  const outPath = resolve(OUT_DIR, entry.file);
  if (existsSync(outPath)) {
    console.log(`SKIP  ${entry.file} (exists — delete to regenerate)`);
    continue;
  }
  process.stdout.write(`→ ${entry.file} ... `);
  try {
    const buf = await requestAudio(entry.text, entry.voice, entry.settings);
    writeFileSync(outPath, buf);
    console.log(`OK (${(buf.byteLength / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.log(`FAIL: ${err.message}`);
  }
}

console.log("\nDone. Files in", OUT_DIR);
