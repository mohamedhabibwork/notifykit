import { Notifier } from "./core/notifier.js";
import { createWhatsAppProvider } from "./drivers/whatsapp/driver.js";
import type { WhatsAppConfig, WhatsAppNotifierConfig } from "./drivers/whatsapp/config.js";
import type {
  WhatsAppDeliveryStatus,
  WhatsAppNativeOptions,
  WhatsAppRecipient,
  WhatsAppResponse,
  WhatsAppWebhookStatus,
} from "./drivers/whatsapp/types.js";
import { parseWhatsAppWebhookEvent, verifyWhatsAppSignature } from "./drivers/whatsapp/webhook.js";

export type {
  WhatsAppConfig,
  WhatsAppNotifierConfig,
  WhatsAppNativeOptions,
  WhatsAppRecipient,
  WhatsAppResponse,
  WhatsAppDeliveryStatus,
  WhatsAppWebhookStatus,
};
export type WhatsAppNotifier = Notifier<
  "whatsapp",
  WhatsAppRecipient,
  WhatsAppConfig,
  WhatsAppNativeOptions,
  WhatsAppResponse
>;
export async function createWhatsAppNotifier(
  config: WhatsAppNotifierConfig,
): Promise<WhatsAppNotifier> {
  return new Notifier(await createWhatsAppProvider({ ...config, type: "whatsapp" }));
}
export { parseWhatsAppWebhookEvent, verifyWhatsAppSignature };
