export interface VonageConfig {
  type: "vonage";
  /** Vonage API key from the dashboard. */
  apiKey: string;
  /** Vonage API secret; sent only to the configured API host. */
  apiSecret: string;
  /** Default sender ID (alphanumeric or E.164); overridable per message with native.from. */
  defaultFrom?: string;
  /** REST API base URL; defaults to "https://rest.nexmo.com". */
  apiUrl?: string;
}
export type VonageNotifierConfig = Omit<VonageConfig, "type">;
