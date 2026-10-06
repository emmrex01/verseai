import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

/**
 * Two model tiers, per job:
 * - fast: high-volume per-chapter extraction, query planning, profiles.
 * - reasoning: contradiction detection, entity resolution, answering questions.
 */
export const MODELS = {
  fast: process.env.AI_FAST_MODEL ?? "claude-haiku-4-5",
  reasoning: process.env.AI_REASONING_MODEL ?? "claude-opus-5-5",
} as const;
export type ModelTier = keyof typeof MODELS;

/** USD per million tokens: [input, output, cache read, cache write]. */
const PRICING: Record<string, [number, number, number, number]> = {
  "claude-haiku-4-5": [1, 5, 0.1, 1.25],
  "claude-opus-5-5": [4, 20, 0.2, 5],
  "claude-sonnet-5-5": [2, 10, 0.2, 2.5],
};

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export const emptyUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0, costUsd: 0 });

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    costUsd: a.costUsd + b.costUsd,
  };
}

export class AIError extends Error {}
export class RefusalError extends AIError {}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 4 });
  return client;
}

interface StructuredCall<S extends z.ZodType> {
  tier: ModelTier;
  system: string;
  user: string;
  schema: S;
  maxTokens?: number;
  /** Reasoning tier only. */
  effort?: "low" | "medium" | "high";
}

/**
 * One structured-output request. Returns parsed, schema-valid data plus usage.
 * The stable system prompt is marked cacheable so per-chapter calls reuse it.
 */
export async function callStructured<S extends z.ZodType>(
  call: StructuredCall<S>,
): Promise<{ data: z.infer<S>; usage: Usage }> {
  // Network/5xx/429 retries are handled by the SDK. Here we retry once when the
  // model's output was cut off or didn't validate, since a fresh sample usually succeeds.
  try {
    return await callOnce(call);
  } catch (err) {
    const retryable = (err instanceof AIError && !(err instanceof RefusalError)) || (err instanceof Anthropic.AnthropicError && !(err instanceof Anthropic.APIError));
    if (!retryable) throw err;
    return callOnce({ ...call, maxTokens: Math.min(32000, (call.maxTokens ?? 16000) * 2) });
  }
}

async function callOnce<S extends z.ZodType>(call: StructuredCall<S>): Promise<{ data: z.infer<S>; usage: Usage }> {
  const model = MODELS[call.tier];
  const reasoning = call.tier === "reasoning";

  const response = await anthropic().beta.messages.parse({
    model,
    max_tokens: call.maxTokens ?? 16000,
    system: [{ type: "text", text: call.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: call.user }],
    output_config: {
      format: betaZodOutputFormat(call.schema),
      ...(reasoning ? { effort: call.effort ?? "medium" } : {}),
    },
    ...(reasoning
      ? {
          thinking: { type: "adaptive" as const },
          // Re-run on Anthropic's recommended model if a safety classifier declines
          // (e.g. a thriller manuscript with violent scenes).
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default" as const,
        }
      : {}),
  });

  const usage = usageOf(response.model ?? model, response.usage);

  if (response.stop_reason === "refusal") {
    throw new RefusalError("The model declined to analyze this passage.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new AIError("The analysis response was cut off before it finished.");
  }
  if (response.parsed_output == null) {
    throw new AIError("The model returned output that did not match the expected format.");
  }
  return { data: response.parsed_output as z.infer<S>, usage };
}

function usageOf(model: string, u: Anthropic.Beta.BetaUsage): Usage {
  const [inP, outP, readP, writeP] = PRICING[model] ?? PRICING["claude-opus-5-5"];
  const read = u.cache_read_input_tokens ?? 0;
  const write = u.cache_creation_input_tokens ?? 0;
  const costUsd =
    (u.input_tokens * inP + u.output_tokens * outP + read * readP + write * writeP) / 1_000_000;
  return { inputTokens: u.input_tokens + read + write, outputTokens: u.output_tokens, costUsd };
}

/** Run async tasks with bounded concurrency, preserving input order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
