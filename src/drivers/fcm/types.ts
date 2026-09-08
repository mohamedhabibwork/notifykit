export type FcmRecipient =
  | { token: string }
  | { tokens: readonly string[] }
  | { topic: string }
  | { condition: string };
export interface FcmNativeOptions {
  android?: {
    priority?: 'normal' | 'high';
    ttl?: number;
    collapseKey?: string;
    notification?: Record<string, unknown>;
  };
  apns?: { headers?: Record<string, string>; payload?: Record<string, unknown> };
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
