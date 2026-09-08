export type EmailAddress = string | { email: string; name?: string }; export type EmailRecipient = EmailAddress | readonly EmailAddress[];
export interface EmailNativeOptions { html?: string; text?: string; from?: EmailAddress; replyTo?: EmailAddress; cc?: EmailRecipient; bcc?: EmailRecipient; headers?: Record<string, string>; attachments?: readonly { filename?: string; content: string | Uint8Array; contentType?: string }[]; }
export interface EmailResponse { messageId?: string; accepted?: readonly string[]; rejected?: readonly string[]; response?: string; [key: string]: unknown; }
