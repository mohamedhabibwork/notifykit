export type WhatsAppRecipient = { phoneNumber: string };

/**
 * Cloud API `/messages` payload fields beyond the envelope the driver builds
 * (`messaging_product`, `to`). Pass `type: "template"` with a `template`
 * block for approved templates, or `type: "text"` plus `text` for freeform.
 * Unlisted Cloud API fields are accepted via the index signature.
 */
export interface WhatsAppNativeOptions {
  type?:
    | "text"
    | "template"
    | "image"
    | "audio"
    | "video"
    | "document"
    | "sticker"
    | "location"
    | "contacts"
    | "interactive"
    | "reaction";
  text?: { preview_url?: boolean; body: string };
  template?: {
    name: string;
    language: { code: string; policy?: string };
    components?: readonly Record<string, unknown>[];
  };
  [key: string]: unknown;
}

/** Cloud API send response (subset). */
export interface WhatsAppResponse {
  messaging_product?: "whatsapp";
  contacts?: readonly { wa_id?: string; input?: string }[];
  messages?: readonly { id?: string; message_status?: string }[];
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_data?: { details?: string };
    error_user_msg?: string;
    fbtrace_id?: string;
  };
  [key: string]: unknown;
}

/** Final delivery states reported by webhook `statuses` entries. */
export type WhatsAppWebhookStatus = "sent" | "delivered" | "read" | "failed" | "deleted";

/** One flattened webhook status entry from parseWhatsAppWebhookEvent. */
export interface WhatsAppDeliveryStatus {
  messageId: string;
  status: WhatsAppWebhookStatus;
  /** Unix seconds, as sent by Meta. */
  timestamp: number;
  recipientPhone?: string;
  conversation?: Record<string, unknown>;
  pricing?: Record<string, unknown>;
  errors?: readonly {
    code?: number;
    title?: string;
    message?: string;
    error_data?: Record<string, unknown>;
  }[];
}
