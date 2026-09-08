import { Notifier } from './core/notifier.js';
import type { FcmConfig, FcmNativeOptions, FcmRecipient, FcmResponse } from './fcm.js';
import { createFcmProvider } from './drivers/fcm/driver.js';
import type { HuaweiConfig, HuaweiNativeOptions, HuaweiRecipient, HuaweiResponse } from './huawei.js';
import { createHuaweiProvider } from './drivers/huawei/driver.js';
import type { WebPushConfig, WebPushNativeOptions, WebPushRecipient, WebPushResponse } from './webpush.js';
import { createWebPushProvider } from './drivers/webpush/driver.js';
import type { EmailConfig, EmailNativeOptions, EmailRecipient, EmailResponse } from './email.js';
import { createEmailProvider } from './drivers/email/driver.js';
import type { TelegramConfig, TelegramNativeOptions, TelegramRecipient, TelegramResponse } from './telegram.js';
import { createTelegramProvider } from './drivers/telegram/driver.js';
import type { ApnsConfig, ApnsNativeOptions, ApnsRecipient, ApnsResponse } from './apns.js';
import { createApnsProvider } from './drivers/apns/driver.js';
import type { NotificationDriverDefinition } from './core/provider.js';
export type BuiltInNotificationConfig =
  | FcmConfig
  | HuaweiConfig
  | WebPushConfig
  | EmailConfig
  | TelegramConfig
  | ApnsConfig;
export type NotifierForConfig<T> = T extends FcmConfig
  ? Notifier<'fcm', FcmRecipient, FcmConfig, FcmNativeOptions, FcmResponse>
  : T extends HuaweiConfig
    ? Notifier<'huawei', HuaweiRecipient, HuaweiConfig, HuaweiNativeOptions, HuaweiResponse>
    : T extends WebPushConfig
      ? Notifier<'webpush', WebPushRecipient, WebPushConfig, WebPushNativeOptions, WebPushResponse>
      : T extends EmailConfig
        ? Notifier<'email', EmailRecipient, EmailConfig, EmailNativeOptions, EmailResponse>
        : T extends TelegramConfig
          ? Notifier<'telegram', TelegramRecipient, TelegramConfig, TelegramNativeOptions, TelegramResponse>
          : T extends ApnsConfig
            ? Notifier<'apns', ApnsRecipient, ApnsConfig, ApnsNativeOptions, ApnsResponse>
            : never;
export async function createNotifier<const TConfig extends BuiltInNotificationConfig>(
  config: TConfig,
): Promise<NotifierForConfig<TConfig>>;
export async function createNotifier<TName extends string, TConfig, TRecipient, TNative, TResponse>(
  config: TConfig & { type: TName },
  options: {
    providers: readonly NotificationDriverDefinition<
      TName,
      TConfig & { type: TName },
      TRecipient,
      TNative,
      TResponse
    >[];
  },
): Promise<Notifier<TName, TRecipient, TConfig & { type: TName }, TNative, TResponse>>;
export async function createNotifier(
  config: BuiltInNotificationConfig | { type: string },
  options?: unknown,
): Promise<unknown> {
  let provider;
  switch (config.type) {
    case 'fcm':
      provider = await createFcmProvider(config as FcmConfig);
      break;
    case 'huawei':
      provider = await createHuaweiProvider(config as HuaweiConfig);
      break;
    case 'webpush':
      provider = await createWebPushProvider(config as WebPushConfig);
      break;
    case 'email':
      provider = await createEmailProvider(config as EmailConfig);
      break;
    case 'telegram':
      provider = await createTelegramProvider(config as TelegramConfig);
      break;
    case 'apns':
      provider = await createApnsProvider(config as ApnsConfig);
      break;
    default: {
      const providers = (
        options as
          | { providers?: readonly NotificationDriverDefinition<string, unknown, unknown, unknown, unknown>[] }
          | undefined
      )?.providers;
      const definition = providers?.find((candidate) => candidate.name === config.type);
      if (!definition) throw new Error(`Unknown notification provider "${config.type}".`);
      provider = await definition.create(config as never);
    }
  }
  return new Notifier(provider as never) as never;
}
