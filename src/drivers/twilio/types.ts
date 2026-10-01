/**
 * Recipient phone number in E.164 (`+15551234567`) or with the `whatsapp:`
 * prefix for Twilio's WhatsApp channel.
 */
export type TwilioRecipient = { phoneNumber: string };

/**
 * Additional message parameters posted to the Twilio Messages resource.
 * Values must survive `URLSearchParams` serialization (strings/numbers).
 */
export interface TwilioNativeOptions {
  from?: string;
  messagingServiceSid?: string;
  /** Overrides config.statusCallbackUrl for this message. */
  statusCallback?: string;
  /** MMS media URLs (repeat the parameter per URL, as Twilio requires). */
  mediaUrl?: readonly string[];
  /** Shorten links in the body with Twilio's link shortener. */
  shortenUrls?: boolean;
  maxPrice?: number | string;
  provideFeedback?: boolean;
  attempt?: number | string;
  validityPeriod?: number | string;
  /** Content SID for Twilio Content API templates (structured templating). */
  contentSid?: string;
  /** Variables for the Content SID template, JSON-encoded by the driver. */
  contentVariables?: Record<string, string>;
  /** Smart encoding / A2P campaign fields pass through here. */
  [key: string]: unknown;
}

/** Twilio Messages REST resource response (subset). */
export interface TwilioResponse {
  sid?: string;
  status?:
    | "queued"
    | "accepted"
    | "sent"
    | "delivered"
    | "undelivered"
    | "failed"
    | "read"
    | string;
  to?: string;
  from?: string;
  num_segments?: string;
  error_code?: number | null;
  error_message?: string | null;
  code?: number;
  message?: string;
  more_info?: string;
  [key: string]: unknown;
}

/** Status callback states Twilio reports for outbound messages. */
export type TwilioCallbackStatus =
  | "queued"
  | "accepted"
  | "sent"
  | "delivered"
  | "undelivered"
  | "failed"
  | "read";

/** One parsed Twilio status callback (form-encoded webhook body). */
export interface TwilioDeliveryStatus {
  messageSid: string;
  status: TwilioCallbackStatus;
  to?: string;
  from?: string;
  channelPrefix?: string;
  errorCode?: number;
  errorMessage?: string;
  /** Present for WhatsApp senders, without the `whatsapp:` prefix. */
  whatsapp?: boolean;
}
