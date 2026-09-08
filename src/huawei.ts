import { Notifier } from './core/notifier.js';
import { createHuaweiProvider } from './drivers/huawei/driver.js';
import type { HuaweiConfig, HuaweiNotifierConfig } from './drivers/huawei/config.js';
import type {
  HuaweiAccessToken,
  HuaweiApnsOptions,
  HuaweiNativeClient,
  HuaweiNativeOptions,
  HuaweiRecipient,
  HuaweiResponse,
  HuaweiTokenCache,
} from './drivers/huawei/types.js';
export type {
  HuaweiAccessToken,
  HuaweiApnsOptions,
  HuaweiConfig,
  HuaweiNotifierConfig,
  HuaweiNativeOptions,
  HuaweiRecipient,
  HuaweiResponse,
  HuaweiTokenCache,
};
export interface HuaweiNotifier extends Notifier<
  'huawei',
  HuaweiRecipient,
  HuaweiConfig,
  HuaweiNativeOptions,
  HuaweiResponse
> {
  native(): HuaweiNativeClient | undefined;
}
export async function createHuaweiNotifier(config: HuaweiNotifierConfig): Promise<HuaweiNotifier> {
  return new Notifier(await createHuaweiProvider({ ...config, type: 'huawei' })) as HuaweiNotifier;
}
