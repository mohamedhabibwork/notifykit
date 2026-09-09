import { Notifier } from './core/notifier.js';
import { createSlackProvider } from './drivers/slack/driver.js';
import type { SlackConfig, SlackNotifierConfig } from './drivers/slack/config.js';
import type { SlackNativeOptions, SlackRecipient, SlackResponse } from './drivers/slack/types.js';

export type { SlackConfig, SlackNotifierConfig, SlackNativeOptions, SlackRecipient, SlackResponse };
export type SlackNotifier = Notifier<'slack', SlackRecipient, SlackConfig, SlackNativeOptions, SlackResponse>;
export async function createSlackNotifier(config: SlackNotifierConfig): Promise<SlackNotifier> {
  return new Notifier(await createSlackProvider({ ...config, type: 'slack' }));
}
