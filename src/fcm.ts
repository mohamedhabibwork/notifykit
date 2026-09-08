import { Notifier } from './core/notifier.js';
import { createFcmProvider } from './drivers/fcm/driver.js';
import type { FcmConfig, FcmNotifierConfig } from './drivers/fcm/config.js';
import type {
  FcmAccessToken,
  FcmApnsOptions,
  FcmNativeClient,
  FcmNativeOptions,
  FcmRecipient,
  FcmResponse,
  FcmTokenCache,
} from './drivers/fcm/types.js';
export type {
  FcmConfig,
  FcmNotifierConfig,
  FcmAccessToken,
  FcmApnsOptions,
  FcmNativeClient,
  FcmNativeOptions,
  FcmRecipient,
  FcmResponse,
  FcmTokenCache,
};
export interface FcmNotifier extends Notifier<'fcm', FcmRecipient, FcmConfig, FcmNativeOptions, FcmResponse> {
  native(): FcmNativeClient | undefined;
}
export async function createFcmNotifier(config: FcmNotifierConfig): Promise<FcmNotifier> {
  return new Notifier(await createFcmProvider({ ...config, type: 'fcm' })) as FcmNotifier;
}
