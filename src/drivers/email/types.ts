export type EmailAddress = string | { email: string; name?: string };
export type EmailRecipient = EmailAddress | readonly EmailAddress[];
export interface EmailNativeOptions {
  html?: string;
  text?: string;
  from?: EmailAddress;
  replyTo?: EmailAddress;
  cc?: EmailRecipient;
  bcc?: EmailRecipient;
  /** SMTP precedence header: "high" adds Importance/Priority headers, "low" adds Precedence: bulk. */
  priority?: "high" | "normal" | "low";
  /** Message-ID this mail replies to (paired with `references` for mail clients' threading). */
  inReplyTo?: string;
  /** Message-IDs of the thread this mail belongs to. */
  references?: readonly string[];
  headers?: Record<string, string>;
  attachments?: readonly {
    filename?: string;
    content: string | Uint8Array;
    contentType?: string;
    cid?: string;
    encoding?: string;
  }[];
}
export interface EmailResponse {
  messageId?: string;
  accepted?: readonly string[];
  rejected?: readonly string[];
  response?: string;
  [key: string]: unknown;
}
