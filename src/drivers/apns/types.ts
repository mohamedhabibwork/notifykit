export type ApnsRecipient = { deviceToken: string } | { deviceTokens: readonly string[] };
export interface ApnsNativeOptions {
  topic?: string;
  pushType?: 'alert' | 'background' | 'voip' | 'complication' | 'fileprovider' | 'mdm' | 'liveactivity';
  expiration?: number;
  priority?: 5 | 10;
  collapseId?: string;
  payload?: Record<string, unknown>;
}
export interface ApnsResponse {
  sent?: readonly string[];
  failed?: readonly { device: string; response?: unknown; error?: unknown }[];
  [key: string]: unknown;
}
