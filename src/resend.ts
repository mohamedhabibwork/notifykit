import { Notifier } from "./core/notifier.js";
import { createResendProvider } from "./drivers/resend/driver.js";
import type { ResendConfig, ResendNotifierConfig } from "./drivers/resend/config.js";
import type {
  ResendAddress,
  ResendNativeOptions,
  ResendRecipient,
  ResendResponse,
  ResendWebhookEvent,
  ResendWebhookEventType,
} from "./drivers/resend/types.js";
import { parseResendWebhookEvent, verifyResendWebhook } from "./drivers/resend/webhook.js";

export type {
  ResendConfig,
  ResendNotifierConfig,
  ResendAddress,
  ResendNativeOptions,
  ResendRecipient,
  ResendResponse,
  ResendWebhookEvent,
  ResendWebhookEventType,
};
export type ResendNotifier = Notifier<
  "resend",
  ResendRecipient,
  ResendConfig,
  ResendNativeOptions,
  ResendResponse
>;
export async function createResendNotifier(config: ResendNotifierConfig): Promise<ResendNotifier> {
  return new Notifier(await createResendProvider({ ...config, type: "resend" }));
}
export { parseResendWebhookEvent, verifyResendWebhook };
