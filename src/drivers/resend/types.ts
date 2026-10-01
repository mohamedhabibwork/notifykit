export type ResendAddress = string | { email: string; name?: string };
export type ResendRecipient = ResendAddress | readonly ResendAddress[];

const formatAddress = (input: ResendAddress): string =>
  typeof input === "string" ? input : input.name ? `${input.name} <${input.email}>` : input.email;

/** Serializes an address or address list the way the Resend API expects. */
export const serializeResendAddress = (input: ResendAddress): string => formatAddress(input);
export const serializeResendAddressList = (input: ResendRecipient): string[] =>
  (Array.isArray(input) ? input : [input]).map(formatAddress);

/** Resend send parameters beyond subject/recipients. */
export interface ResendNativeOptions {
  from?: ResendAddress;
  text?: string;
  html?: string;
  replyTo?: ResendAddress | readonly ResendAddress[];
  cc?: ResendRecipient;
  bcc?: ResendRecipient;
  headers?: Record<string, string>;
  attachments?: readonly {
    filename?: string;
    /** Base64-encoded content or raw string content. */
    content: string | Uint8Array;
    contentType?: string;
  }[];
  tags?: readonly { name: string; value: string }[];
  /** ISO 8601 datetime to schedule the send (Resend Batch/Schedules). */
  scheduledAt?: string;
}

/** Resend send-email response. */
export interface ResendResponse {
  id?: string;
  name?: string;
  message?: string;
  statusCode?: number;
  [key: string]: unknown;
}

/** Resend webhook event types relevant to delivery status. */
export type ResendWebhookEventType =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.bounced"
  | "email.complained"
  | "email.opened"
  | "email.clicked"
  | "email.failed";

/** One parsed Resend webhook event. */
export interface ResendWebhookEvent {
  type: ResendWebhookEventType | string;
  createdAt?: string;
  /** The send response id (matches NotificationResult.messageId). */
  emailId?: string;
  to?: readonly string[];
  from?: string;
  subject?: string;
  raw: Record<string, unknown>;
}
