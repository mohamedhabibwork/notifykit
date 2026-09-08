import { Notifier } from './core/notifier.js';
import { createWebPushProvider } from './drivers/webpush/driver.js';
import type { WebPushConfig, WebPushNotifierConfig } from './drivers/webpush/config.js';
import type { WebPushNativeOptions, WebPushRecipient, WebPushResponse } from './drivers/webpush/types.js';
export type { WebPushConfig, WebPushNotifierConfig, WebPushNativeOptions, WebPushRecipient, WebPushResponse };
export type WebPushNotifier = Notifier<
  'webpush',
  WebPushRecipient,
  WebPushConfig,
  WebPushNativeOptions,
  WebPushResponse
>;
export async function createWebPushNotifier(config: WebPushNotifierConfig): Promise<WebPushNotifier> {
  return new Notifier(await createWebPushProvider({ ...config, type: 'webpush' }));
}
