import { Type, type Schema } from "@google/genai";

/** Minimal provider-neutral JSON Schema (the subset we use for structured output). */
export type JsonSchema =
  | { type: "string"; description?: string }
  | { type: "number" | "integer" | "boolean"; description?: string }
  | { type: "array"; items: JsonSchema; description?: string }
  | { type: "object"; properties: Record<string, JsonSchema>; required: string[]; description?: string };

export const S = {
  str: (description?: string): JsonSchema => ({ type: "string", ...(description ? { description } : {}) }),
  arr: (items: JsonSchema): JsonSchema => ({ type: "array", items }),
  /** Object whose properties are all required (needed for OpenAI strict mode). */
  obj: (properties: Record<string, JsonSchema>): JsonSchema => ({ type: "object", properties, required: Object.keys(properties) }),
};

/** OpenAI strict structured outputs: every object needs additionalProperties:false. */
export function toOpenAI(s: JsonSchema): Record<string, unknown> {
  switch (s.type) {
    case "object":
      return {
        type: "object",
        properties: Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toOpenAI(v)])),
        required: s.required,
        additionalProperties: false,
      };
    case "array":
      return { type: "array", items: toOpenAI(s.items) };
    default:
      return { type: s.type };
  }
}

/** Gemini's OpenAPI-style schema. */
export function toGemini(s: JsonSchema): Schema {
  switch (s.type) {
    case "object":
      return { type: Type.OBJECT, properties: Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGemini(v)])), required: s.required };
    case "array":
      return { type: Type.ARRAY, items: toGemini(s.items) };
    case "string":
      return { type: Type.STRING };
    case "integer":
      return { type: Type.INTEGER };
    case "number":
      return { type: Type.NUMBER };
    case "boolean":
      return { type: Type.BOOLEAN };
  }
}
