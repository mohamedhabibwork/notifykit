import { NotificationRateLimitError, isRetryableNotificationError } from "../core/errors.js";
import type { NotificationMiddleware, NotificationResult } from "../core/types.js";
import { defaultSleep, type Sleep } from "./sleep.js";

export interface RetryOptions {
  /** Extra attempts after the first one. Default 3. */
  retries?: number;
  /** First backoff delay in ms. Default 200. */
  minDelay?: number;
  /** Upper bound for a single delay in ms. Default 10_000. */
  maxDelay?: number;
  /** Exponential growth factor. Default 2. */
  factor?: number;
  /** Apply full jitter to delays. Default true. */
  jitter?: boolean;
  /** Decide whether a thrown error should be retried. Defaults to `error.retryable`. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Called before each retry wait. */
  onRetry?: (info: { attempt: number; delay: number; error?: unknown }) => void;
  sleep?: Sleep;
}

const MS_PER_SECOND = 1000;

/** Retries retryable errors and `{ ok: false, retryable: true }` results with exponential backoff. */
export function retryMiddleware(options: RetryOptions = {}): NotificationMiddleware {
  const retries = Math.max(0, options.retries ?? 3);
  const minDelay = options.minDelay ?? 200;
  const maxDelay = options.maxDelay ?? 10_000;
  const factor = options.factor ?? 2;
  const jitter = options.jitter ?? true;
  const shouldRetry = options.shouldRetry ?? ((error) => isRetryableNotificationError(error));
  const sleep = options.sleep ?? defaultSleep;
  const delayFor = (attempt: number, error?: unknown): number => {
    if (error instanceof NotificationRateLimitError && error.retryAfter != null)
      return Math.min(maxDelay, error.retryAfter * MS_PER_SECOND);
    const base = Math.min(maxDelay, minDelay * factor ** attempt);
    return jitter ? Math.round(Math.random() * base) : base;
  };
  return async (_context, next) => {
    for (let attempt = 0; ; attempt++) {
      let result: NotificationResult;
      try {
        result = await next();
      } catch (error) {
        if (attempt >= retries || !shouldRetry(error, attempt)) throw error;
        const delay = delayFor(attempt, error);
        options.onRetry?.({ attempt: attempt + 1, delay, error });
        await sleep(delay);
        continue;
      }
      if (result.ok || !result.retryable || attempt >= retries) return result;
      const delay = delayFor(attempt);
      options.onRetry?.({ attempt: attempt + 1, delay });
      await sleep(delay);
    }
  };
}
