import { Notifier } from "./core/notifier.js";
import type { FcmConfig, FcmNotifier } from "./fcm.js";
import { createFcmProvider } from "./drivers/fcm/driver.js";
import type { HuaweiConfig, HuaweiNotifier } from "./huawei.js";
import { createHuaweiProvider } from "./drivers/huawei/driver.js";
import type {
  WebPushConfig,
  WebPushNativeOptions,
  WebPushRecipient,
  WebPushResponse,
} from "./webpush.js";
import { createWebPushProvider } from "./drivers/webpush/driver.js";
import type { EmailConfig, EmailNativeOptions, EmailRecipient, EmailResponse } from "./email.js";
import { createEmailProvider } from "./drivers/email/driver.js";
import type {
  TelegramConfig,
  TelegramNativeOptions,
  TelegramRecipient,
  TelegramResponse,
} from "./telegram.js";
import { createTelegramProvider } from "./drivers/telegram/driver.js";
import type { ApnsConfig, ApnsNativeOptions, ApnsRecipient, ApnsResponse } from "./apns.js";
import { createApnsProvider } from "./drivers/apns/driver.js";
import type { SlackConfig, SlackNotifier } from "./slack.js";
import { createSlackProvider } from "./drivers/slack/driver.js";
import type {
  WhatsAppConfig,
  WhatsAppNativeOptions,
  WhatsAppRecipient,
  WhatsAppResponse,
} from "./whatsapp.js";
import { createWhatsAppProvider } from "./drivers/whatsapp/driver.js";
import type {
  TwilioConfig,
  TwilioNativeOptions,
  TwilioRecipient,
  TwilioResponse,
} from "./twilio.js";
import { createTwilioProvider } from "./drivers/twilio/driver.js";
import type {
  VonageConfig,
  VonageNativeOptions,
  VonageRecipient,
  VonageResponse,
} from "./vonage.js";
import { createVonageProvider } from "./drivers/vonage/driver.js";
import type {
  ResendConfig,
  ResendNativeOptions,
  ResendRecipient,
  ResendResponse,
} from "./resend.js";
import { createResendProvider } from "./drivers/resend/driver.js";
import type { NotificationDriverDefinition } from "./core/provider.js";
export type BuiltInNotificationConfig =
  | FcmConfig
  | HuaweiConfig
  | WebPushConfig
  | EmailConfig
  | TelegramConfig
  | ApnsConfig
  | SlackConfig
  | WhatsAppConfig
  | TwilioConfig
  | VonageConfig
  | ResendConfig;
export type NotifierForConfig<T> = T extends FcmConfig
  ? FcmNotifier
  : T extends HuaweiConfig
    ? HuaweiNotifier
    : T extends WebPushConfig
      ? Notifier<"webpush", WebPushRecipient, WebPushConfig, WebPushNativeOptions, WebPushResponse>
      : T extends EmailConfig
        ? Notifier<"email", EmailRecipient, EmailConfig, EmailNativeOptions, EmailResponse>
        : T extends TelegramConfig
          ? Notifier<
              "telegram",
              TelegramRecipient,
              TelegramConfig,
              TelegramNativeOptions,
              TelegramResponse
            >
          : T extends ApnsConfig
            ? Notifier<"apns", ApnsRecipient, ApnsConfig, ApnsNativeOptions, ApnsResponse>
            : T extends SlackConfig
              ? SlackNotifier
              : T extends WhatsAppConfig
                ? Notifier<
                    "whatsapp",
                    WhatsAppRecipient,
                    WhatsAppConfig,
                    WhatsAppNativeOptions,
                    WhatsAppResponse
                  >
                : T extends TwilioConfig
                  ? Notifier<
                      "twilio",
                      TwilioRecipient,
                      TwilioConfig,
                      TwilioNativeOptions,
                      TwilioResponse
                    >
                  : T extends VonageConfig
                    ? Notifier<
                        "vonage",
                        VonageRecipient,
                        VonageConfig,
                        VonageNativeOptions,
                        VonageResponse
                      >
                    : T extends ResendConfig
                      ? Notifier<
                          "resend",
                          ResendRecipient,
                          ResendConfig,
                          ResendNativeOptions,
                          ResendResponse
                        >
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
    case "fcm":
      provider = await createFcmProvider(config as FcmConfig);
      break;
    case "huawei":
      provider = await createHuaweiProvider(config as HuaweiConfig);
      break;
    case "webpush":
      provider = await createWebPushProvider(config as WebPushConfig);
      break;
    case "email":
      provider = await createEmailProvider(config as EmailConfig);
      break;
    case "telegram":
      provider = await createTelegramProvider(config as TelegramConfig);
      break;
    case "apns":
      provider = await createApnsProvider(config as ApnsConfig);
      break;
    case "slack":
      provider = await createSlackProvider(config as SlackConfig);
      break;
    case "whatsapp":
      provider = await createWhatsAppProvider(config as WhatsAppConfig);
      break;
    case "twilio":
      provider = await createTwilioProvider(config as TwilioConfig);
      break;
    case "vonage":
      provider = await createVonageProvider(config as VonageConfig);
      break;
    case "resend":
      provider = await createResendProvider(config as ResendConfig);
      break;
    default: {
      const providers = (
        options as
          | {
              providers?: readonly NotificationDriverDefinition<
                string,
                unknown,
                unknown,
                unknown,
                unknown
              >[];
            }
          | undefined
      )?.providers;
      const definition = providers?.find((candidate) => candidate.name === config.type);
      if (!definition) throw new Error(`Unknown notification provider "${config.type}".`);
      provider = await definition.create(config as never);
    }
  }
  return new Notifier(provider as never) as never;
}
