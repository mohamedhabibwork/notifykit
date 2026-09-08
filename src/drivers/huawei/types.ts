export type HuaweiRecipient = { token: string } | { tokens: readonly string[] } | { topic: string };
export interface HuaweiAccessToken {
  accessToken: string;
  /** Unix timestamp in milliseconds. */
  expiresAt: number;
}
export interface HuaweiApnsOptions {
  headers?: Record<string, string>;
  payload?: {
    aps?: {
      mutableContent?: boolean;
      'mutable-content'?: 1;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
export interface HuaweiNativeOptions {
  android?: Record<string, unknown>;
  apns?: HuaweiApnsOptions;
  webpush?: Record<string, unknown>;
}
export interface HuaweiResponse {
  code?: string;
  msg?: string;
  requestId?: string;
  [key: string]: unknown;
}
export interface HuaweiTokenCache {
  get(): Promise<HuaweiAccessToken | undefined>;
  set(token: HuaweiAccessToken): Promise<void>;
}
export interface HuaweiNativeClient {
  getAccessToken(options?: { signal?: AbortSignal; timeout?: number }): Promise<HuaweiAccessToken>;
}
