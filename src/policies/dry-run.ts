import type { NotificationMessage, NotificationMiddleware } from "../core/types.js";

export interface DryRunOptions {
  /** Toggle at runtime, e.g. `process.env.NOTIFY_DRY_RUN === "1"`. Default true. */
  enabled?: boolean | (() => boolean);
  /** Observe what would have been sent. */
  onMessage?: (
    message: Readonly<NotificationMessage<unknown, unknown>> | undefined,
    provider: string,
  ) => void;
}

/** Skips the provider call and returns an accepted result marked `native.dryRun`. */
export function dryRunMiddleware(options: DryRunOptions = {}): NotificationMiddleware {
  const isEnabled = () =>
    typeof options.enabled === "function" ? options.enabled() : (options.enabled ?? true);
  return async (context, next) => {
    if (!isEnabled()) return next();
    options.onMessage?.(context.message, context.provider);
    return { ok: true, provider: context.provider, status: "accepted", native: { dryRun: true } };
  };
}
