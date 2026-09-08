export type HuaweiRecipient = { token: string } | { tokens: readonly string[] } | { topic: string };
export interface HuaweiNativeOptions { android?: Record<string, unknown>; apns?: Record<string, unknown>; webpush?: Record<string, unknown>; }
export interface HuaweiResponse { code?: string; msg?: string; requestId?: string; [key: string]: unknown; }
export interface HuaweiTokenCache { get(): Promise<{ accessToken: string; expiresAt: number } | undefined>; set(token: { accessToken: string; expiresAt: number }): Promise<void>; }
