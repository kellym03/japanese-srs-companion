import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

export interface GenerateObjectWithFallbackOptions<T> {
  schema: z.ZodType<T>;
  prompt: string;
  system?: string;
  models?: string[];
  maxRetriesPerModel?: number;
  initialDelayMs?: number;
  temperature?: number;
  abortSignal?: AbortSignal;
}

export interface GenerateObjectWithFallbackResult<T> {
  object: T;
  modelUsed: string;
  fallbackOccurred: boolean;
  totalAttempts: number;
}

/**
 * Checks whether an error is transient, rate-limited, overloaded, or capacity-related
 * and therefore safe and recommended to retry or failover.
 */
export function isRetryableOrOverloadError(error: unknown): boolean {
  if (!error) return false;

  const status =
    (error as any)?.status ||
    (error as any)?.statusCode ||
    (error as any)?.response?.status;

  if (typeof status === "number") {
    // 429 Too Many Requests, 500 Server Error, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout
    if ([429, 500, 502, 503, 504].includes(status)) {
      return true;
    }
  }

  const message = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();

  const retryableIndicators = [
    "overload",
    "high traffic",
    "traffic volume",
    "resource_exhausted",
    "resourceexhausted",
    "rate limit",
    "ratelimit",
    "quota",
    "unavailable",
    "try again later",
    "capacity",
    "timeout",
    "timed out",
    "etimedout",
    "econnreset",
    "fetch failed",
    "503",
    "429",
  ];

  return retryableIndicators.some((kw) => message.includes(kw));
}

/**
 * Resolves the ordered fallback list of Gemini models.
 */
export function getModelChain(customModels?: string[]): string[] {
  if (customModels && customModels.length > 0) {
    return Array.from(new Set(customModels));
  }

  const primary = process.env.AI_PRIMARY_MODEL || "gemini-2.5-flash";

  const envFallbacks = process.env.AI_FALLBACK_MODELS
    ? process.env.AI_FALLBACK_MODELS.split(",")
        .map((m) => m.trim())
        .filter(Boolean)
    : [];

  const defaults = [
    primary,
    ...envFallbacks,
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-3.6-flash",
    "gemini-1.5-flash",
  ];

  // Return unique ordered array
  return Array.from(new Set(defaults));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes generateObject across a cascading chain of AI models with exponential backoff and jitter.
 * If the primary model returns "high traffic volume", 503, 429, or fails, it automatically
 * retries and seamlessly falls back to the next available model in the fleet.
 */
export async function generateObjectWithFallback<T>(
  options: GenerateObjectWithFallbackOptions<T>
): Promise<GenerateObjectWithFallbackResult<T>> {
  const {
    schema,
    prompt,
    system,
    models,
    maxRetriesPerModel = 2,
    initialDelayMs = 1200,
    temperature,
    abortSignal,
  } = options;

  const modelChain = getModelChain(models);
  let totalAttempts = 0;
  let lastError: unknown = null;
  const attemptedModels: string[] = [];

  for (let modelIndex = 0; modelIndex < modelChain.length; modelIndex++) {
    const currentModelId = modelChain[modelIndex];
    attemptedModels.push(currentModelId);
    const isPrimary = modelIndex === 0;

    for (let retry = 0; retry < maxRetriesPerModel; retry++) {
      totalAttempts++;

      try {
        const modelInstance = google(currentModelId);

        const result = await generateObject({
          model: modelInstance,
          schema,
          prompt,
          system,
          temperature,
          abortSignal,
        });

        if (!isPrimary || retry > 0) {
          console.info(
            `[AI Fallback] Successfully generated response using ${currentModelId} (Attempt ${totalAttempts}, fallback: ${!isPrimary})`
          );
        }

        return {
          object: result.object as T,
          modelUsed: currentModelId,
          fallbackOccurred: !isPrimary,
          totalAttempts,
        };
      } catch (err: unknown) {
        lastError = err;
        const errMsg = err instanceof Error ? err.message : String(err);
        const retryable = isRetryableOrOverloadError(err);

        console.warn(
          `[AI Warning] Model ${currentModelId} attempt ${retry + 1}/${maxRetriesPerModel} failed: ${errMsg}`
        );

        // If this retry is eligible for a retry on the same model
        if (retryable && retry < maxRetriesPerModel - 1) {
          const delay =
            initialDelayMs * Math.pow(2, retry) + Math.floor(Math.random() * 400);
          console.info(
            `[AI Retry] Retrying ${currentModelId} in ${delay}ms due to transient capacity/traffic spike...`
          );
          await sleep(delay);
          continue;
        }

        // Retries exhausted for this model or non-retryable for this specific model, break to try next fallback model
        break;
      }
    }

    if (modelIndex < modelChain.length - 1) {
      const nextModel = modelChain[modelIndex + 1];
      console.warn(
        `[AI Fallback] Failing over from ${currentModelId} to next candidate model: ${nextModel}`
      );
    }
  }

  // If all models in the fallback chain were exhausted
  const failureMessage =
    lastError instanceof Error
      ? lastError.message
      : "All models in the fallback chain failed";

  console.error(
    `[AI Error] All fallback models exhausted (${attemptedModels.join(" -> ")}). Last error: ${failureMessage}`
  );

  const errorWithMeta = new Error(failureMessage);
  (errorWithMeta as any).attemptedModels = attemptedModels;
  (errorWithMeta as any).totalAttempts = totalAttempts;
  (errorWithMeta as any).isOverloaded = isRetryableOrOverloadError(lastError);
  (errorWithMeta as any).originalError = lastError;

  throw errorWithMeta;
}
