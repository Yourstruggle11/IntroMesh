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
  /** Total time budget across all providers (the first gets most of it, fallbacks get the rest). */
  timeoutMs?: number;
  /** Prefer low-latency models where the provider has a choice. */
  fast?: boolean;
};

/** Structured JSON from the first provider that succeeds. Returns null if all fail (callers use heuristics). */
/** Time left for attempt `i` of `count`: earlier providers leave room for the fallbacks. */
function attemptBudget(deadline: number, i: number, count: number) {
  const left = deadline - Date.now();
  return i === count - 1 ? left : Math.round(left * 0.65);
}

export async function generateJson<T>(opts: GenOpts & { schema: JsonSchema; name: string }): Promise<T | null> {
  const list = providers();
  const deadline = Date.now() + (opts.timeoutMs ?? 15000);
  for (const [i, p] of list.entries()) {
    const timeoutMs = attemptBudget(deadline, i, list.length);
    if (timeoutMs < 400) break;
    try {
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
  const list = providers();
  const deadline = Date.now() + (opts.timeoutMs ?? 15000);
  for (const [i, p] of list.entries()) {
    const timeoutMs = attemptBudget(deadline, i, list.length);
    if (timeoutMs < 400) break;
    try {
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
