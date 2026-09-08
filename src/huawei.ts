import { Notifier } from './core/notifier.js';
import { createHuaweiProvider } from './drivers/huawei/driver.js';
import type { HuaweiConfig, HuaweiNotifierConfig } from './drivers/huawei/config.js';
import type { HuaweiNativeOptions, HuaweiRecipient, HuaweiResponse, HuaweiTokenCache } from './drivers/huawei/types.js';
export type {
  HuaweiConfig,
  HuaweiNotifierConfig,
  HuaweiNativeOptions,
  HuaweiRecipient,
  HuaweiResponse,
  HuaweiTokenCache,
};
export type HuaweiNotifier = Notifier<'huawei', HuaweiRecipient, HuaweiConfig, HuaweiNativeOptions, HuaweiResponse>;
export async function createHuaweiNotifier(config: HuaweiNotifierConfig): Promise<HuaweiNotifier> {
  return new Notifier(await createHuaweiProvider({ ...config, type: 'huawei' }));
}
