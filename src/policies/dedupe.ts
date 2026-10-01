import type {
  NotificationMiddleware,
  NotificationResult,
  NotificationSendContext,
} from "../core/types.js";

export interface DedupeOptions {
  /** How long a key is remembered, in ms. Default 10 minutes. */
  ttl?: number;
  /** Derive the dedupe key. Defaults to `message.idempotencyKey`; undefined disables dedupe for that send. */
  key?: (context: NotificationSendContext) => string | undefined;
  now?: () => number;
}

interface Entry {
  expiresAt: number;
  result: Promise<NotificationResult>;
}

const DEFAULT_TTL = 10 * 60 * 1000;

/** In-process idempotency: concurrent or repeated sends with the same key share one provider call. */
export function dedupeMiddleware(options: DedupeOptions = {}): NotificationMiddleware {
  const ttl = options.ttl ?? DEFAULT_TTL;
  const now = options.now ?? Date.now;
  const keyOf = options.key ?? ((context) => context.message?.idempotencyKey);
  const seen = new Map<string, Entry>();
  const prune = (at: number) => {
    for (const [key, entry] of seen) if (entry.expiresAt <= at) seen.delete(key);
  };
  return async (context, next) => {
    const key = keyOf(context);
    if (key === undefined) return next();
    const at = now();
    prune(at);
    const existing = seen.get(`${context.provider}:${key}`);
    if (existing) return existing.result;
    const scoped = `${context.provider}:${key}`;
    const result = next();
    seen.set(scoped, { expiresAt: at + ttl, result });
    try {
      return await result;
    } catch (error) {
      seen.delete(scoped);
      throw error;
    }
  };
}
