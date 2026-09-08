import { createNotifier, type BuiltInNotificationConfig, type NotifierForConfig } from './factory.js';
import type { NotificationResult } from './core/types.js';
type ProviderMap = Record<string, BuiltInNotificationConfig>;
type MultiChannel<T extends ProviderMap> = {
  [K in keyof T]: { provider: K; message: Parameters<NotifierForConfig<T[K]>['send']>[0] };
}[keyof T];
export class NotificationManager<
  TProviders extends ProviderMap,
  TDefault extends keyof TProviders | undefined = undefined,
> {
  private readonly initialized = new Map<keyof TProviders, Promise<NotifierForConfig<TProviders[keyof TProviders]>>>();
  private closed = false;
  constructor(private readonly options: { providers: TProviders; default?: TDefault }) {}
  provider<TKey extends keyof TProviders>(name: TKey): Promise<NotifierForConfig<TProviders[TKey]>> {
    if (this.closed) return Promise.reject(new Error('Notification manager is closed.'));
    let notifier = this.initialized.get(name);
    if (!notifier) {
      notifier = createNotifier(this.options.providers[name]) as Promise<NotifierForConfig<TProviders[TKey]>>;
      this.initialized.set(name, notifier as Promise<NotifierForConfig<TProviders[keyof TProviders]>>);
    }
    return notifier as Promise<NotifierForConfig<TProviders[TKey]>>;
  }
  default(): TDefault extends keyof TProviders ? Promise<NotifierForConfig<TProviders[TDefault]>> : never {
    if (!this.options.default) throw new Error('No default notification provider is configured.');
    return this.provider(this.options.default) as never;
  }
  async warmup(): Promise<void> {
    await Promise.all(Object.keys(this.options.providers).map((key) => this.provider(key)));
  }
  async sendMulti(channels: readonly MultiChannel<TProviders>[]): Promise<readonly NotificationResult[]> {
    return Promise.all(
      channels.map(async ({ provider, message }) => (await this.provider(provider)).send(message as never)),
    );
  }
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await Promise.all([...this.initialized.values()].map(async (notifier) => (await notifier).close()));
  }
}
export function createNotificationManager<
  const TProviders extends ProviderMap,
  TDefault extends keyof TProviders | undefined = undefined,
>(options: { providers: TProviders; default?: TDefault }): NotificationManager<TProviders, TDefault> {
  return new NotificationManager(options);
}
