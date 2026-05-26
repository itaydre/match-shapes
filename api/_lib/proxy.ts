// Shared proxy logic for the p5-lab AI generator. Used by:
//   - api/generate.ts          → Vercel serverless function (production)
//   - vite.p5.config.ts plugin → Vite dev middleware (local)
//
// Files under api/_lib/ are NOT exposed as routes by Vercel (leading
// underscore convention). Only api/*.ts at the top level become functions.

export const SYSTEM_PROMPT = `You are an expert generative-art coder. You write p5.js (instance mode) sketches for a soccer match-card playground. Each sketch animates the white pitch area of a match card and reads its tweakable parameters from a controls object.

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

export type Msg = { role: "user" | "assistant"; content: string };

export type ProxyResult =
  | { status: 200; body: unknown }
  | { status: number; body: { error: string } };

export const callAnthropic = async (
  messages: Msg[],
  apiKey: string | undefined,
): Promise<ProxyResult> => {
  if (!apiKey) {
    return {
      status: 500,
      body: {
        error:
          "ANTHROPIC_API_KEY is not set. In dev, start with `ANTHROPIC_API_KEY=sk-... npm run p5lab`. In production, set it in the Vercel project's Environment Variables.",
      },
    };
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return { status: 400, body: { error: "Missing or empty messages array." } };
  }

  let upstream: Response;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
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
  } catch (err) {
    return {
      status: 502,
      body: { error: `Upstream fetch failed: ${(err as Error).message}` },
    };
  }

  const data = (await upstream.json()) as unknown;
  if (!upstream.ok) {
    return {
      status: upstream.status,
      body: { error: `Anthropic ${upstream.status}: ${JSON.stringify(data)}` },
    };
  }
  return { status: 200, body: data };
};

// Helper for the Vite dev middleware (Node IncomingMessage). Reads the
// JSON body off `req` and returns the parsed value, or null on error.
import type { IncomingMessage } from "http";
export const readJsonBody = async (
  req: IncomingMessage,
): Promise<unknown | null> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
