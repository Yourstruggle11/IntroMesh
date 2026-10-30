import "server-only";
import { geminiEnabled, geminiJson, geminiModel, geminiText } from "./gemini";
import { openaiEnabled, openaiJson, openaiModel, openaiText } from "./openai";
import type { JsonSchema } from "./schema";

type Provider = "openai" | "gemini";

/** Provider order: AI Grants (OpenAI-compatible) first, Gemini as fallback. Override with AI_PROVIDER_ORDER. */
function providers(): Provider[] {
  const order = (process.env.AI_PROVIDER_ORDER || "openai,gemini").split(",").map((s) => s.trim());
  return order.filter((p): p is Provider => (p === "openai" && openaiEnabled()) || (p === "gemini" && geminiEnabled()));
}

export function aiEnabled() {
  return providers().length > 0;
}

/** Human-readable provider chain, e.g. "openai:gpt-5-nano → gemini:gemini-3.5-flash". */
export function aiDescribe() {
  return providers()
    .map((p) => (p === "openai" ? `openai:${openaiModel()}` : `gemini:${geminiModel()}`))
    .join(" → ");
}

type GenOpts = {
  system: string;
  prompt: string;
  temperature?: number;
  /** Per-provider timeout. */
  timeoutMs?: number;
  /** Prefer low-latency models where the provider has a choice. */
  fast?: boolean;
};

/** Structured JSON from the first provider that succeeds. Returns null if all fail (callers use heuristics). */
export async function generateJson<T>(opts: GenOpts & { schema: JsonSchema; name: string }): Promise<T | null> {
  for (const p of providers()) {
    try {
      const timeoutMs = opts.timeoutMs ?? 15000;
      const r =
        p === "openai"
          ? await openaiJson<T>({ system: opts.system, prompt: opts.prompt, schema: opts.schema, name: opts.name, timeoutMs })
          : await geminiJson<T>({ system: opts.system, prompt: opts.prompt, schema: opts.schema, temperature: opts.temperature ?? 0.4, timeoutMs, fast: opts.fast });
      if (r) return r;
    } catch (err) {
      console.warn(`[ai:${p}] ${opts.name} failed: ${(err as Error).message?.slice(0, 200)}`);
    }
  }
  return null;
}

export async function generateText(opts: GenOpts & { name: string }): Promise<string | null> {
  for (const p of providers()) {
    try {
      const timeoutMs = opts.timeoutMs ?? 15000;
      const r =
        p === "openai"
          ? await openaiText({ system: opts.system, prompt: opts.prompt, timeoutMs })
          : await geminiText({ system: opts.system, prompt: opts.prompt, temperature: opts.temperature ?? 0.6, timeoutMs, fast: opts.fast });
      if (r) return r;
    } catch (err) {
      console.warn(`[ai:${p}] ${opts.name} failed: ${(err as Error).message?.slice(0, 200)}`);
    }
  }
  return null;
}
