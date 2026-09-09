export { createNotifier, type BuiltInNotificationConfig, type NotifierForConfig } from './factory.js';
export { NotificationManager, createNotificationManager } from './manager.js';
export { Notifier } from './core/notifier.js';
export type { NotificationProvider, NotificationDriverDefinition } from './core/provider.js';
export type {
  BatchNotificationResult,
  BatchSendOptions,
  NotificationAction,
  NotificationCapabilities,
  NotificationContent,
  NotificationHooks,
  NotificationMessage,
  NotificationMessageSource,
  NotificationMiddleware,
  NotificationResult,
  NotificationSendContext,
  SendOptions,
} from './core/types.js';
export {
  NotificationError,
  NotificationConfigError,
  NotificationAuthenticationError,
  NotificationRecipientError,
  NotificationRateLimitError,
  NotificationPayloadError,
  NotificationProviderError,
  NotificationNetworkError,
  NotificationTimeoutError,
  NotificationUnsupportedError,
  isRetryableNotificationError,
} from './core/errors.js';
export type { NotificationErrorContext } from './core/errors.js';
export { createNotificationRouter } from './routing/index.js';
export { createNotificationTemplates } from './templates/index.js';
export { createSlackNotifier } from './slack.js';
export type {
  SlackConfig,
  SlackNativeOptions,
  SlackNotifier,
  SlackNotifierConfig,
  SlackRecipient,
  SlackResponse,
} from './slack.js';
