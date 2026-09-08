export type FcmRecipient =
  | { token: string }
  | { tokens: readonly string[] }
  | { topic: string }
  | { condition: string };
export interface FcmAccessToken {
  accessToken: string;
  /** Unix timestamp in milliseconds. */
  expiresAt: number;
}
export interface FcmTokenCache {
  get(): Promise<FcmAccessToken | undefined>;
  set(token: FcmAccessToken): Promise<void>;
}
export interface FcmApnsOptions {
  headers?: Record<string, string>;
  payload?: {
    aps?: {
      /** Enables an iOS Notification Service Extension. */
      mutableContent?: boolean;
      /** Raw APNs spelling accepted by FCM's HTTP v1 payload. */
      'mutable-content'?: 1;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  /** FCM-to-APNs options, including the rich-notification image URL. */
  fcmOptions?: { imageUrl?: string; analyticsLabel?: string };
}
export interface FcmNativeClient {
  app: unknown;
  messaging: unknown;
  getAccessToken(): Promise<FcmAccessToken>;
}
export interface FcmNativeOptions {
  android?: {
    priority?: 'normal' | 'high';
    ttl?: number;
    collapseKey?: string;
    notification?: Record<string, unknown>;
  };
  apns?: FcmApnsOptions;
  webpush?: {
    headers?: Record<string, string>;
    notification?: Record<string, unknown>;
    fcmOptions?: Record<string, unknown>;
  };
  fcmOptions?: Record<string, unknown>;
}
export interface FcmResponse {
  messageId?: string;
  [key: string]: unknown;
}
