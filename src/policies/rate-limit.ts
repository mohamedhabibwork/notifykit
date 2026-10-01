import type { NotificationMiddleware } from "../core/types.js";
import { defaultSleep, type Sleep } from "./sleep.js";

export interface RateLimitOptions {
  /** Maximum sends per interval. */
  limit: number;
  /** Window length in ms. */
  interval: number;
  now?: () => number;
  sleep?: Sleep;
}

/** Sliding-window limiter that delays (never drops) sends exceeding `limit` per `interval`. */
export function rateLimitMiddleware(options: RateLimitOptions): NotificationMiddleware {
  if (!Number.isInteger(options.limit) || options.limit < 1)
    throw new RangeError("rateLimitMiddleware: limit must be a positive integer.");
  if (!Number.isFinite(options.interval) || options.interval <= 0)
    throw new RangeError("rateLimitMiddleware: interval must be a positive number.");
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const starts: number[] = [];
  let queue: Promise<void> = Promise.resolve();
  const acquire = async (): Promise<void> => {
    for (;;) {
      const at = now();
      while (starts.length > 0 && starts[0]! <= at - options.interval) starts.shift();
      if (starts.length < options.limit) {
        starts.push(at);
        return;
      }
      await sleep(starts[0]! + options.interval - at);
    }
  };
  return async (_context, next) => {
    const slot = queue.then(acquire);
    queue = slot.catch(() => {});
    await slot;
    return next();
  };
}
