import "server-only";
import { GoogleGenAI } from "@google/genai";
import { toGemini, type JsonSchema } from "./schema";

let client: GoogleGenAI | null = null;

export function geminiEnabled() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function getClient() {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  return client;
}

/** Quality model for writing; fast model for short structured tasks. */
export function geminiModel(fast = false) {
  if (fast) return process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash-lite";
  return process.env.GEMINI_MODEL || "gemini-3.5-flash";
}

type Common = { system: string; prompt: string; temperature: number; timeoutMs: number; fast?: boolean };

export async function geminiJson<T>(opts: Common & { schema: JsonSchema }): Promise<T | null> {
  const res = await getClient().models.generateContent({
    model: geminiModel(opts.fast),
    contents: opts.prompt,
    config: {
      systemInstruction: opts.system,
      temperature: opts.temperature,
      responseMimeType: "application/json",
      responseSchema: toGemini(opts.schema),
      abortSignal: AbortSignal.timeout(opts.timeoutMs),
    },
  });
  return res.text ? (JSON.parse(res.text) as T) : null;
}

export async function geminiText(opts: Common): Promise<string | null> {
  const res = await getClient().models.generateContent({
    model: geminiModel(opts.fast),
    contents: opts.prompt,
    config: { systemInstruction: opts.system, temperature: opts.temperature, abortSignal: AbortSignal.timeout(opts.timeoutMs) },
  });
  return res.text?.trim() || null;
}
