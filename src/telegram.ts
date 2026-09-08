import { Notifier } from './core/notifier.js'; import { createTelegramProvider } from './drivers/telegram/driver.js';
import type { TelegramConfig, TelegramNotifierConfig } from './drivers/telegram/config.js'; import type { TelegramNativeOptions, TelegramRecipient, TelegramResponse } from './drivers/telegram/types.js';
export type { TelegramConfig, TelegramNotifierConfig, TelegramNativeOptions, TelegramRecipient, TelegramResponse };
export type TelegramNotifier = Notifier<'telegram', TelegramRecipient, TelegramConfig, TelegramNativeOptions, TelegramResponse>;
export async function createTelegramNotifier(config: TelegramNotifierConfig): Promise<TelegramNotifier> { return new Notifier(await createTelegramProvider({ ...config, type: 'telegram' })); }
