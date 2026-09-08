export interface ApnsConfig {
  type: 'apns';
  token: { key: string; keyId: string; teamId: string };
  production?: boolean;
}
export type ApnsNotifierConfig = Omit<ApnsConfig, 'type'>;
