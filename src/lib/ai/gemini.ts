import "server-only";
import { GoogleGenAI, type Schema } from "@google/genai";

let client: GoogleGenAI | null = null;

export function aiEnabled() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function getClient() {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  return client;
}

/** Quality model for writing; fast model for short structured tasks. */
export function aiModel(fast = false) {
  if (fast) return process.env.GEMINI_FAST_MODEL || "gemini-3.5-flash-lite";
  return process.env.GEMINI_MODEL || "gemini-3.5-flash";
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`AI timeout after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

type GenOpts = {
  system: string;
  prompt: string;
  temperature?: number;
  timeoutMs?: number;
  /** Use the low-latency model. */
  fast?: boolean;
};

/** Structured JSON generation. Returns null on any failure so callers can fall back. */
export async function generateJson<T>(opts: GenOpts & { schema: Schema }): Promise<T | null> {
  if (!aiEnabled()) return null;
  try {
    const res = await withTimeout(
      getClient().models.generateContent({
        model: aiModel(opts.fast),
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          temperature: opts.temperature ?? 0.4,
          responseMimeType: "application/json",
          responseSchema: opts.schema,
        },
      }),
      opts.timeoutMs ?? 15000,
    );
    const text = res.text;
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch (err) {
    console.warn("[ai] generateJson failed:", (err as Error).message);
    return null;
  }
}

export async function generateText(opts: GenOpts): Promise<string | null> {
  if (!aiEnabled()) return null;
  try {
    const res = await withTimeout(
      getClient().models.generateContent({
        model: aiModel(opts.fast),
        contents: opts.prompt,
        config: { systemInstruction: opts.system, temperature: opts.temperature ?? 0.6 },
      }),
      opts.timeoutMs ?? 15000,
    );
    return res.text?.trim() || null;
  } catch (err) {
    console.warn("[ai] generateText failed:", (err as Error).message);
    return null;
  }
}
