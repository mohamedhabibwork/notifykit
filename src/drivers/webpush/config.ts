export interface WebPushConfig { type: 'webpush'; vapid: { subject: string; publicKey: string; privateKey: string; }; }
export type WebPushNotifierConfig = Omit<WebPushConfig, 'type'>;
