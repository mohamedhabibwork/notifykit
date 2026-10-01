import type { NotificationResult } from "../core/types.js";

export interface FallbackOutcome<TResult extends NotificationResult = NotificationResult> {
  /** The first successful result, or undefined if every attempt failed. */
  result?: TResult;
  /** Index of the successful attempt, or -1. */
  attempt: number;
  /** Thrown errors or failed results from earlier attempts, in order. */
  errors: readonly unknown[];
}

/** Tries each attempt in order and stops at the first `ok` result. Never throws for send failures. */
export async function sendWithFallback<TResult extends NotificationResult>(
  attempts: readonly (() => Promise<TResult>)[],
): Promise<FallbackOutcome<TResult>> {
  const errors: unknown[] = [];
  for (const [index, attempt] of attempts.entries()) {
    try {
      const result = await attempt();
      if (result.ok) return { result, attempt: index, errors };
      errors.push(result);
    } catch (error) {
      errors.push(error);
    }
  }
  return { attempt: -1, errors };
}
