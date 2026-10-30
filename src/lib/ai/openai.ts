import "server-only";
import OpenAI from "openai";
import { toOpenAI, type JsonSchema } from "./schema";

/**
 * OpenAI-compatible provider (AI Grants key → gpt-5-nano).
 * OPENAI_BASE_URL can point at a compatible gateway if the key requires one.
 */
let client: OpenAI | null = null;
let reasoningParamUnsupported = false;

export function openaiEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function openaiModel() {
  return process.env.OPENAI_MODEL || "gpt-5-nano";
}

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL || undefined, maxRetries: 0 });
  }
  return client;
}

type Common = { system: string; prompt: string; timeoutMs: number };

async function complete(opts: Common & { responseFormat?: OpenAI.Chat.Completions.ChatCompletionCreateParams["response_format"] }) {
  const run = (withReasoning: boolean) =>
    getClient().chat.completions.create(
      {
        model: openaiModel(),
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.prompt },
        ],
        ...(opts.responseFormat ? { response_format: opts.responseFormat } : {}),
        // gpt-5 family: keep latency low. (Temperature is fixed for these models, so we don't send it.)
        ...(withReasoning ? { reasoning_effort: "minimal" as const } : {}),
        max_completion_tokens: 2000,
      },
      { signal: AbortSignal.timeout(opts.timeoutMs) },
    );
  try {
    return await run(!reasoningParamUnsupported);
  } catch (err) {
    const msg = String((err as Error).message ?? "");
    if (!reasoningParamUnsupported && /reasoning/i.test(msg) && /unsupported|not supported|invalid/i.test(msg)) {
      reasoningParamUnsupported = true;
      return run(false);
    }
    throw err;
  }
}

export async function openaiJson<T>(opts: Common & { schema: JsonSchema; name: string }): Promise<T | null> {
  const res = await complete({
    ...opts,
    responseFormat: { type: "json_schema", json_schema: { name: opts.name, strict: true, schema: toOpenAI(opts.schema) } },
  });
  const msg = res.choices[0]?.message;
  if (!msg || msg.refusal || !msg.content) return null;
  return JSON.parse(msg.content) as T;
}

export async function openaiText(opts: Common): Promise<string | null> {
  const res = await complete(opts);
  return res.choices[0]?.message?.content?.trim() || null;
}
