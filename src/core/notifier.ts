import type { NotificationProvider } from './provider.js';
import type {
  BatchNotificationResult,
  BatchSendOptions,
  NotificationHooks,
  NotificationMessage,
  NotificationMessageSource,
  NotificationMiddleware,
  NotificationResult,
  NotificationSendContext,
  SendOptions,
} from './types.js';
import { sendAsCompleted, sendConcurrently, validateMessage } from './utils.js';

export class Notifier<TName extends string, TRecipient, TConfig, TNative, TResponse> {
  readonly name: TName;
  readonly capabilities;
  private readonly middlewares: NotificationMiddleware[] = [];
  private closed = false;
  constructor(
    private readonly provider: NotificationProvider<TName, TRecipient, TConfig, TNative, TResponse>,
    private readonly hooks?: NotificationHooks,
    private readonly alias?: string,
  ) {
    this.name = provider.name;
    this.capabilities = provider.capabilities;
  }
  use(middleware: NotificationMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }
  native(): unknown {
    return this.provider.native?.();
  }
  async send(
    message: NotificationMessage<TRecipient, TNative>,
    options?: SendOptions,
  ): Promise<NotificationResult<TName, TResponse>> {
    if (this.closed) throw new Error(`Notifier "${this.name}" is closed.`);
    validateMessage(message, this.name);
    const context: NotificationSendContext = {
      provider: this.name,
      providerAlias: this.alias,
      operation: 'send',
      startedAt: performance.now(),
      metadata: options?.metadata,
    };
    await this.hooks?.beforeSend?.(context);
    const dispatch = async (index: number): Promise<NotificationResult<TName, TResponse>> =>
      index === this.middlewares.length
        ? this.provider.send(message, options)
        : (this.middlewares[index]!(context, () => dispatch(index + 1)) as Promise<
            NotificationResult<TName, TResponse>
          >);
    try {
      const result = await dispatch(0);
      await this.hooks?.afterSend?.(context, result);
      return result;
    } catch (error) {
      await this.hooks?.onError?.(context, error);
      throw error;
    }
  }
  async sendMany(
    messages: NotificationMessageSource<TRecipient, TNative>,
    options?: BatchSendOptions,
  ): Promise<BatchNotificationResult<TName, TResponse>> {
    if (this.closed) throw new Error(`Notifier "${this.name}" is closed.`);
    if (this.provider.sendMany && Array.isArray(messages)) return this.provider.sendMany(messages, options);
    return sendConcurrently(messages, (message) => this.send(message, options), this.name, options?.concurrency);
  }
  /** Stream completed results for an iterable or async iterable without buffering a batch in memory. */
  sendEach(
    messages: NotificationMessageSource<TRecipient, TNative>,
    options?: BatchSendOptions,
  ): AsyncGenerator<NotificationResult<TName, TResponse>> {
    if (this.closed) throw new Error(`Notifier "${this.name}" is closed.`);
    return sendAsCompleted(messages, (message) => this.send(message, options), this.name, options?.concurrency);
  }
  async close(): Promise<void> {
    if (!this.closed) {
      this.closed = true;
      await this.provider.close?.();
    }
  }
}
export type AnyNotifier = Notifier<string, unknown, unknown, unknown, unknown>;
