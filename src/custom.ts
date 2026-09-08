export type { NotificationDriverDefinition, NotificationProvider } from './core/provider.js';
export type { NotificationCapabilities, NotificationMessage, NotificationResult } from './core/types.js';
import type { NotificationDriverDefinition } from './core/provider.js';
export function defineNotificationProvider<TName extends string, TConfig, TRecipient, TNativeSend, TResponse = unknown>(
  definition: NotificationDriverDefinition<TName, TConfig, TRecipient, TNativeSend, TResponse>,
): NotificationDriverDefinition<TName, TConfig, TRecipient, TNativeSend, TResponse> {
  return definition;
}
