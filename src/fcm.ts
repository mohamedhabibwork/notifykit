import { Notifier } from './core/notifier.js';
import { createFcmProvider } from './drivers/fcm/driver.js';
import type { FcmConfig, FcmNotifierConfig } from './drivers/fcm/config.js';
import type { FcmNativeOptions, FcmRecipient, FcmResponse } from './drivers/fcm/types.js';
export type { FcmConfig, FcmNotifierConfig, FcmNativeOptions, FcmRecipient, FcmResponse };
export type FcmNotifier = Notifier<'fcm', FcmRecipient, FcmConfig, FcmNativeOptions, FcmResponse>;
export async function createFcmNotifier(config: FcmNotifierConfig): Promise<FcmNotifier> {
  return new Notifier(await createFcmProvider({ ...config, type: 'fcm' }));
}
