import type { FcmTokenCache } from './types.js';

export interface FcmConfig {
  type: 'fcm';
  credential:
    | { projectId: string; clientEmail: string; privateKey: string }
    | { serviceAccount: Record<string, unknown> };
  appName?: string;
  auth?: {
    /** Optional application-owned cache shared across notifier instances. */
    tokenCache?: FcmTokenCache;
    /** Refresh before expiry; defaults to 30 seconds. */
    refreshSkewMs?: number;
  };
}
export type FcmNotifierConfig = Omit<FcmConfig, 'type'>;
