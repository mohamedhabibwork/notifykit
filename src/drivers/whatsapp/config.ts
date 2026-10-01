export interface WhatsAppConfig {
  type: "whatsapp";
  /** WhatsApp Business phone number ID (Graph API resource id). */
  phoneNumberId: string;
  /** System-user or business access token with whatsapp_business_messaging. */
  accessToken: string;
  /** Graph API version segment; defaults to "v23.0". */
  apiVersion?: string;
  /** Graph API base URL; defaults to "https://graph.facebook.com". */
  apiUrl?: string;
  /** App secret, required only to verify webhook payloads with verifyWhatsAppSignature. */
  appSecret?: string;
}
export type WhatsAppNotifierConfig = Omit<WhatsAppConfig, "type">;
