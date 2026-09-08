import type {
  BatchNotificationResult,
  NotificationCapabilities,
  NotificationMessage,
  NotificationResult,
  SendOptions,
} from './types.js';
export interface NotificationProvider<
  TName extends string,
  TRecipient,
  _TNativeConfig,
  TNativeSendOptions,
  TNativeResponse = unknown,
> {
  readonly name: TName;
  readonly capabilities: NotificationCapabilities;
  send(
    message: NotificationMessage<TRecipient, TNativeSendOptions>,
    options?: SendOptions,
  ): Promise<NotificationResult<TName, TNativeResponse>>;
  sendMany?(
    messages: readonly NotificationMessage<TRecipient, TNativeSendOptions>[],
    options?: SendOptions,
  ): Promise<BatchNotificationResult<TName, TNativeResponse>>;
  native?(): unknown;
  close?(): Promise<void> | void;
}
export interface NotificationDriverDefinition<
  TName extends string,
  TConfig,
  TRecipient,
  TNativeSend,
  TNativeResponse = unknown,
> {
  readonly name: TName;
  readonly capabilities: NotificationCapabilities;
  create(config: TConfig): Promise<NotificationProvider<TName, TRecipient, TConfig, TNativeSend, TNativeResponse>>;
}
