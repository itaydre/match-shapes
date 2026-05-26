// Vercel serverless function. Path: POST /api/generate.
// ANTHROPIC_API_KEY is read from Vercel's environment at request time —
// never exposed to the browser. Set it in the Vercel project settings
// (Environment Variables → Production / Preview / Development).
//
// Everything is inlined into this single file so Vercel's bundler does
// not need to walk sibling _lib/ files. Local dev (vite.p5.config.ts)
// duplicates the SYSTEM_PROMPT — kept in sync manually.

const SYSTEM_PROMPT = `You are an expert generative-art coder. You write p5.js (instance mode) sketches for a soccer match-card playground. Each sketch animates the white pitch area of a match card and reads its tweakable parameters from a controls object.

Output rules — non-negotiable:
1. Reply with a SINGLE JSON object, nothing else. No prose, no markdown fences. The whole response must parse with JSON.parse.
2. The JSON shape:
   {
     "id": string — kebab-case, unique-ish,
     "name": string — short title,
     "description": string — one sentence,
     "controls": Record<string, ControlSpec>,
     "factoryCode": string — JavaScript source (see below)
   }
3. ControlSpec is one of:
   { "kind": "number", "label": string, "min": number, "max": number, "step": number, "value": number }
   { "kind": "color",  "label": string, "value": string (CSS hex) }
   { "kind": "toggle", "label": string, "value": boolean }
4. factoryCode must be a JavaScript ARROW EXPRESSION of the exact form:
   (getValues, CW, CH) => (p) => { p.setup = () => { ... }; p.draw = () => { ... }; }
   - CW=540 and CH=1040 are the canvas dimensions. Always call p.createCanvas(CW, CH) in p.setup.
   - Inside p.draw, call getValues() once at the top: const v = getValues();
   - Reference controls as v.controlKey.
   - Use only the p5 instance API (p.fill, p.stroke, p.rect, p.circle, p.beginShape, p.vertex, p.noise, p.millis, p.color, etc.).
   - You may use Math.* but NOT window/document/fetch/import/require.
   - Always call p.background(...) at the top of p.draw to clear the canvas.
   - Keep code self-contained and readable, ASCII only.
5. Default any backdrop control to a sensible match-card colour (#F1EEE7 beige, #FFFFFF white, #0E0E0E ink, or a team accent).
6. Match-card teams default to England (red #D5311E, white) vs Brazil (green #009C3B, yellow #FFDF00, blue #002776). Draw palette defaults from these.

Example factoryCode for a ring pulse:
"(getValues, CW, CH) => (p) => { p.setup = () => { p.createCanvas(CW, CH); p.noFill(); }; p.draw = () => { const v = getValues(); p.background(v.backdrop); const t = p.millis() / 1000 * v.rate; for (let i = 0; i < 6; i++) { const phase = (t + i / 6) % 1; const r = phase * v.maxR; const c = p.color(v.color1); c.setAlpha(255 * (1 - phase)); p.stroke(c); p.strokeWeight(v.stroke); p.circle(CW/2, CH/2, r * 2); } }; }"

Respond ONLY with the JSON.`;

type Msg = { role: "user" | "assistant"; content: string };

export default async function handler(
  req: { method?: string; body?: unknown },
  res: {
    status: (n: number) => { json: (b: unknown) => void; send: (b: unknown) => void };
    setHeader?: (k: string, v: string) => void;
  },
) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res
        .status(500)
        .json({
          error:
            "ANTHROPIC_API_KEY is not set. Add it to your Vercel project's Environment Variables (Production + Preview).",
        });
      return;
    }
    const body =
      typeof req.body === "string" ? safeJson(req.body) : (req.body as { messages?: Msg[] } | undefined);
    const messages = Array.isArray(body?.messages) ? (body!.messages as Msg[]) : [];
    if (messages.length === 0) {
      res.status(400).json({ error: "Missing or empty messages array." });
      return;
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: `Anthropic ${upstream.status}: ${JSON.stringify(data)}`,
      });
      return;
    }
    res.status(200).json(data);
  } catch (err) {
    // Always return JSON, never a plain-text Vercel crash page.
    res.status(500).json({ error: `Server error: ${(err as Error).message}` });
  }
}

const safeJson = (s: string): { messages?: Msg[] } | undefined => {
  try {
    return JSON.parse(s) as { messages?: Msg[] };
  } catch {
    return undefined;
  }
};
