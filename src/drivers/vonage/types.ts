export type VonageRecipient = { phoneNumber: string };

/**
 * SMS API parameters beyond from/to/text. Vonage requires unicode flag and
 * TTL etc. as their own fields; unknown fields pass through.
 */
export interface VonageNativeOptions {
  from?: string;
  /** Set true when text contains UTF-16 characters; affects billing/segmentation. */
  type?: "text" | "unicode" | "binary" | "vcal" | "vcard";
  ttl?: number | string;
  /** Mobile-originated flag and other account fields. */
  [key: string]: unknown;
}

/** Vonage SMS JSON response entry. */
export interface VonageResponse {
  "message-count"?: string;
  messages?: readonly {
    status?: string;
    "message-id"?: string;
    to?: string;
    "error-text"?: string;
    network?: string;
    "remaining-balance"?: string;
    "message-price"?: string;
    "client-ref"?: string;
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
}

/** Delivery-receipt (DLR) statuses Vonage reports. */
export type VonageDeliveryReceiptStatus =
  | "delivered"
  | "expired"
  | "failed"
  | "rejected"
  | "accepted"
  | "buffered";

/** One parsed Vonage delivery receipt. */
export interface VonageDeliveryStatus {
  messageId: string;
  status: VonageDeliveryReceiptStatus;
  to?: string;
  from?: string;
  networkCode?: string;
  price?: string;
  /** Carrier error code, present when status is not delivered. */
  errorCode?: string;
  errorLabel?: string;
  /** Handset timestamp (SCTS), e.g. "2001010000". */
  scts?: string;
  clientRef?: string;
}
