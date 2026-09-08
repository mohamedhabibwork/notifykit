export interface NotificationContent {
  title?: string;
  body?: string;
  imageUrl?: string;
}
export interface NotificationAction {
  id: string;
  title: string;
  url?: string;
}
export interface NotificationMessage<
  TRecipient,
  TNative = unknown,
  TData extends Record<string, unknown> = Record<string, unknown>,
> {
  to: TRecipient;
  notification?: NotificationContent;
  data?: TData;
  actions?: readonly NotificationAction[];
  collapseKey?: string;
  ttl?: number;
  priority?: 'normal' | 'high';
  idempotencyKey?: string;
  native?: TNative;
}
export interface NotificationResult<TProvider extends string = string, TNative = unknown> {
  ok: boolean;
  provider: TProvider;
  messageId?: string;
  recipient?: string;
  status: 'sent' | 'accepted' | 'delivered' | 'failed' | 'unknown';
  retryable?: boolean;
  native: TNative;
}
export interface BatchNotificationResult<TProvider extends string = string, TNative = unknown> {
  provider: TProvider;
  total: number;
  successCount: number;
  failureCount: number;
  results: readonly NotificationResult<TProvider, TNative>[];
}
export interface NotificationCapabilities {
  single: boolean;
  batch: boolean;
  token?: boolean;
  topic?: boolean;
  condition?: boolean;
  notification?: boolean;
  data?: boolean;
  image?: boolean;
  actions?: boolean;
  ttl?: boolean;
  priority?: boolean;
  scheduling?: boolean;
}
export interface SendOptions {
  signal?: AbortSignal;
  timeout?: number;
  metadata?: Readonly<Record<string, unknown>>;
}
export interface BatchSendOptions extends SendOptions {
  concurrency?: number;
}
export interface NotificationSendContext {
  provider: string;
  providerAlias?: string;
  operation: 'send' | 'sendMany';
  startedAt: number;
  notificationId?: string;
  traceId?: string;
  metadata?: Readonly<Record<string, unknown>>;
}
export type NotificationMiddleware = (
  context: NotificationSendContext,
  next: () => Promise<NotificationResult>,
) => Promise<NotificationResult>;
export interface NotificationHooks {
  beforeSend?(context: NotificationSendContext): Promise<void> | void;
  afterSend?(context: NotificationSendContext, result: NotificationResult): Promise<void> | void;
  onError?(context: NotificationSendContext, error: unknown): Promise<void> | void;
}
