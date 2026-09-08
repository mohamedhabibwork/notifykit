import {
  NotificationAuthenticationError,
  NotificationNetworkError,
  NotificationProviderError,
  NotificationRateLimitError,
} from '../../core/errors.js';
import type { NotificationProvider } from '../../core/provider.js';
import type { NotificationMessage, NotificationResult, SendOptions } from '../../core/types.js';
import { withTimeout } from '../../core/utils.js';
import type { TelegramConfig } from './config.js';
import type { TelegramNativeOptions, TelegramRecipient, TelegramResponse } from './types.js';
export async function createTelegramProvider(
  config: TelegramConfig,
): Promise<
  NotificationProvider<'telegram', TelegramRecipient, TelegramConfig, TelegramNativeOptions, TelegramResponse>
> {
  const apiUrl = (config.apiUrl ?? 'https://api.telegram.org').replace(/\/$/, '');
  return {
    name: 'telegram',
    capabilities: { single: true, batch: false, topic: true, notification: true, data: false, actions: true },
    native: () => ({ request: fetch }),
    async send(
      message: NotificationMessage<TelegramRecipient, TelegramNativeOptions>,
      options?: SendOptions,
    ): Promise<NotificationResult<'telegram', TelegramResponse>> {
      const chatId = 'chatId' in message.to ? message.to.chatId : message.to.channel;
      const body = {
        chat_id: chatId,
        text: message.notification?.body ?? message.notification?.title ?? '',
        ...message.native,
      };
      let response: Response;
      try {
        response = await withTimeout(
          (signal) =>
            fetch(`${apiUrl}/bot${config.botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
              signal,
            }),
          options,
          'telegram',
        );
      } catch (cause) {
        throw new NotificationNetworkError('Unable to reach the Telegram Bot API.', {
          provider: 'telegram',
          retryable: true,
          cause,
        });
      }
      const native = (await response
        .json()
        .catch(() => ({ ok: false, description: response.statusText }))) as TelegramResponse;
      if (response.ok && native.ok)
        return {
          ok: true,
          provider: 'telegram',
          messageId: native.result?.message_id?.toString(),
          status: 'accepted',
          native,
        };
      if (response.status === 401 || response.status === 403)
        throw new NotificationAuthenticationError('Telegram authentication failed.', {
          provider: 'telegram',
          retryable: false,
          statusCode: response.status,
          native,
        });
      if (response.status === 429)
        throw new NotificationRateLimitError('Telegram rate limit exceeded.', {
          provider: 'telegram',
          retryable: true,
          statusCode: 429,
          native,
        });
      throw new NotificationProviderError(native.description ?? 'Telegram rejected the notification.', {
        provider: 'telegram',
        retryable: response.status >= 500,
        statusCode: response.status,
        native,
      });
    },
  };
}
