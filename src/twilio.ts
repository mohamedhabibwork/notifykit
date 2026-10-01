import { Notifier } from "./core/notifier.js";
import { createTwilioProvider } from "./drivers/twilio/driver.js";
import type { TwilioConfig, TwilioNotifierConfig } from "./drivers/twilio/config.js";
import type {
  TwilioCallbackStatus,
  TwilioDeliveryStatus,
  TwilioNativeOptions,
  TwilioRecipient,
  TwilioResponse,
} from "./drivers/twilio/types.js";
import { parseTwilioStatusCallback, verifyTwilioSignature } from "./drivers/twilio/webhook.js";

export type {
  TwilioConfig,
  TwilioNotifierConfig,
  TwilioNativeOptions,
  TwilioRecipient,
  TwilioResponse,
  TwilioCallbackStatus,
  TwilioDeliveryStatus,
};
export type TwilioNotifier = Notifier<
  "twilio",
  TwilioRecipient,
  TwilioConfig,
  TwilioNativeOptions,
  TwilioResponse
>;
export async function createTwilioNotifier(config: TwilioNotifierConfig): Promise<TwilioNotifier> {
  return new Notifier(await createTwilioProvider({ ...config, type: "twilio" }));
}
export { parseTwilioStatusCallback, verifyTwilioSignature };
