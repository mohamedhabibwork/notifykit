export interface FcmConfig {
  type: 'fcm';
  credential:
    | { projectId: string; clientEmail: string; privateKey: string }
    | { serviceAccount: Record<string, unknown> };
  appName?: string;
}
export type FcmNotifierConfig = Omit<FcmConfig, 'type'>;
