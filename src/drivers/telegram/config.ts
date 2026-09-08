export interface TelegramConfig {
  type: 'telegram';
  botToken: string;
  apiUrl?: string;
}
export type TelegramNotifierConfig = Omit<TelegramConfig, 'type'>;
