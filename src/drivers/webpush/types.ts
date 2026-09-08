export interface WebPushRecipient { endpoint: string; expirationTime?: number | null; keys: { p256dh: string; auth: string; }; }
export interface WebPushNativeOptions { TTL?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; topic?: string; headers?: Record<string, string>; contentEncoding?: 'aesgcm' | 'aes128gcm'; }
export interface WebPushResponse { statusCode?: number; headers?: Record<string, string>; body?: string; [key: string]: unknown; }
