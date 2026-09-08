export interface NotificationErrorContext {
  provider: string;
  code?: string;
  retryable: boolean;
  statusCode?: number;
  recipient?: string;
  cause?: unknown;
  native?: unknown;
}
export class NotificationError extends Error {
  readonly provider: string;
  readonly code?: string;
  readonly retryable: boolean;
  readonly statusCode?: number;
  readonly recipient?: string;
  readonly native?: unknown;
  constructor(message: string, context: NotificationErrorContext) {
    super(message, { cause: context.cause });
    this.name = new.target.name;
    this.provider = context.provider;
    this.code = context.code;
    this.retryable = context.retryable;
    this.statusCode = context.statusCode;
    this.recipient = context.recipient;
    this.native = context.native;
  }
}
export class NotificationConfigError extends NotificationError {}
export class NotificationAuthenticationError extends NotificationError {}
export class NotificationRecipientError extends NotificationError {}
export class NotificationRateLimitError extends NotificationError {
  readonly retryAfter?: number;
  constructor(message: string, context: NotificationErrorContext & { retryAfter?: number }) {
    super(message, context);
    this.retryAfter = context.retryAfter;
  }
}
export class NotificationPayloadError extends NotificationError {}
export class NotificationProviderError extends NotificationError {}
export class NotificationNetworkError extends NotificationError {}
export class NotificationTimeoutError extends NotificationError {}
export class NotificationUnsupportedError extends NotificationError {}
export const isRetryableNotificationError = (error: unknown): error is NotificationError =>
  error instanceof NotificationError && error.retryable;
