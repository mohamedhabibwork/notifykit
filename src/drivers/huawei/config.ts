import type { HuaweiTokenCache } from './types.js';
export interface HuaweiConfig {
  type: 'huawei';
  appId: string;
  appSecret: string;
  /** Push API base URL, primarily for regional endpoints and tests. */ endpoint?: string;
  /** OAuth base URL, primarily for regional endpoints and tests. */ authEndpoint?: string;
  auth?: {
    tokenCache?: HuaweiTokenCache;
    /** Refresh before expiry; defaults to 30 seconds. */
    refreshSkewMs?: number;
  };
}
export type HuaweiNotifierConfig = Omit<HuaweiConfig, 'type'>;
