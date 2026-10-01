import { Notifier } from "./core/notifier.js";
import { createVonageProvider } from "./drivers/vonage/driver.js";
import type { VonageConfig, VonageNotifierConfig } from "./drivers/vonage/config.js";
import type {
  VonageDeliveryReceiptStatus,
  VonageDeliveryStatus,
  VonageNativeOptions,
  VonageRecipient,
  VonageResponse,
} from "./drivers/vonage/types.js";
import { parseVonageDeliveryReceipt } from "./drivers/vonage/webhook.js";

export type {
  VonageConfig,
  VonageNotifierConfig,
  VonageNativeOptions,
  VonageRecipient,
  VonageResponse,
  VonageDeliveryReceiptStatus,
  VonageDeliveryStatus,
};
export type VonageNotifier = Notifier<
  "vonage",
  VonageRecipient,
  VonageConfig,
  VonageNativeOptions,
  VonageResponse
>;
export async function createVonageNotifier(config: VonageNotifierConfig): Promise<VonageNotifier> {
  return new Notifier(await createVonageProvider({ ...config, type: "vonage" }));
}
export { parseVonageDeliveryReceipt };
