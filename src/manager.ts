import {
  createNotifier,
  type BuiltInNotificationConfig,
  type NotifierForConfig,
} from "./factory.js";
import type { NotificationResult } from "./core/types.js";
import { noopLogger, toError, type KitLogger } from "./core/logger.js";
import { sendWithFallback } from "./policies/fallback.js";
export interface SendMultiOptions {
  /** Return false to skip a channel (e.g. from `createPreferenceFilter`). */
  filter?: (provider: string, category?: string) => boolean;
  /** Category passed to `filter`, e.g. "marketing". */
  category?: string;
}
export interface ManagerFallbackOutcome {
  result?: NotificationResult;
  /** Name of the provider that succeeded. */
  provider?: string;
  errors: readonly unknown[];
}
type ProviderMap = Record<string, BuiltInNotificationConfig>;
type MultiChannel<T extends ProviderMap> = {
  [K in keyof T]: { provider: K; message: Parameters<NotifierForConfig<T[K]>["send"]>[0] };
}[keyof T];
export class NotificationManager<
  TProviders extends ProviderMap,
  TDefault extends keyof TProviders | undefined = undefined,
> {
  private readonly initialized = new Map<
    keyof TProviders,
    Promise<NotifierForConfig<TProviders[keyof TProviders]>>
  >();
  private closed = false;
  private readonly logger: KitLogger;
  constructor(
    private readonly options: { providers: TProviders; default?: TDefault; logger?: KitLogger },
  ) {
    this.logger = options.logger ?? noopLogger;
  }
  provider<TKey extends keyof TProviders>(
    name: TKey,
  ): Promise<NotifierForConfig<TProviders[TKey]>> {
    if (this.closed) return Promise.reject(new Error("Notification manager is closed."));
    let notifier = this.initialized.get(name);
    if (!notifier) {
      notifier = createNotifier(this.options.providers[name]).then(
        (created) => {
          this.logger.debug("notifykit: provider created", { provider: String(name) });
          return created;
        },
        (error: unknown) => {
          this.initialized.delete(name);
          this.logger.error(
            `notifykit: failed to create provider "${String(name)}"`,
            toError(error),
          );
          throw error;
        },
      ) as Promise<NotifierForConfig<TProviders[TKey]>>;
      this.initialized.set(
        name,
        notifier as Promise<NotifierForConfig<TProviders[keyof TProviders]>>,
      );
    }
    return notifier as Promise<NotifierForConfig<TProviders[TKey]>>;
  }
  default(): TDefault extends keyof TProviders
    ? Promise<NotifierForConfig<TProviders[TDefault]>>
    : never {
    if (!this.options.default) throw new Error("No default notification provider is configured.");
    return this.provider(this.options.default) as never;
  }
  async warmup(): Promise<void> {
    await Promise.all(Object.keys(this.options.providers).map((key) => this.provider(key)));
  }
  async sendMulti(
    channels: readonly MultiChannel<TProviders>[],
    options?: SendMultiOptions,
  ): Promise<readonly NotificationResult[]> {
    const selected = options?.filter
      ? channels.filter(({ provider }) => options.filter!(String(provider), options.category))
      : channels;
    return Promise.all(
      selected.map(async ({ provider, message }) =>
        (await this.provider(provider)).send(message as never),
      ),
    );
  }
  /** Sends through each channel in order until one succeeds (e.g. push, then SMS, then email). */
  async sendFallback(
    channels: readonly MultiChannel<TProviders>[],
  ): Promise<ManagerFallbackOutcome> {
    const outcome = await sendWithFallback<NotificationResult>(
      channels.map(
        ({ provider, message }) =>
          async () =>
            (await this.provider(provider)).send(message as never),
      ),
    );
    const winner = outcome.attempt >= 0 ? channels[outcome.attempt] : undefined;
    return {
      result: outcome.result,
      provider: winner ? String(winner.provider) : undefined,
      errors: outcome.errors,
    };
  }
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await Promise.all(
      [...this.initialized.values()].map(async (notifier) => (await notifier).close()),
    );
  }
}
export function createNotificationManager<
  const TProviders extends ProviderMap,
  TDefault extends keyof TProviders | undefined = undefined,
>(options: {
  providers: TProviders;
  default?: TDefault;
  logger?: KitLogger;
}): NotificationManager<TProviders, TDefault> {
  return new NotificationManager(options);
}
