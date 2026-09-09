import {
  NotificationAuthenticationError,
  NotificationNetworkError,
  NotificationProviderError,
  NotificationRateLimitError,
} from '../../core/errors.js';
import type { NotificationProvider } from '../../core/provider.js';
import type { NotificationMessage, NotificationResult, SendOptions } from '../../core/types.js';
import { withTimeout } from '../../core/utils.js';
import type { SlackConfig } from './config.js';
import type { SlackNativeOptions, SlackRecipient, SlackResponse } from './types.js';

export async function createSlackProvider(
  config: SlackConfig,
): Promise<NotificationProvider<'slack', SlackRecipient, SlackConfig, SlackNativeOptions, SlackResponse>> {
  if (!config.botToken && !config.webhookUrl) throw new Error('Slack requires botToken or webhookUrl.');
  const apiUrl = (config.apiUrl ?? 'https://slack.com/api').replace(/\/$/, '');
  return {
    name: 'slack',
    capabilities: { single: true, batch: false, topic: true, notification: true, data: false, actions: true },
    native: () => ({ request: fetch }),
    async send(message: NotificationMessage<SlackRecipient, SlackNativeOptions>, options?: SendOptions) {
      const webhookUrl = 'webhookUrl' in message.to ? (message.to.webhookUrl ?? config.webhookUrl) : config.webhookUrl;
      const text = message.notification?.body ?? message.notification?.title ?? '';
      const payload = { text, ...message.native };
      let response: Response;
      try {
        response = await withTimeout(
          (signal) =>
            webhookUrl
              ? fetch(webhookUrl, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify(payload),
                  signal,
                })
              : fetch(`${apiUrl}/chat.postMessage`, {
                  method: 'POST',
                  headers: { authorization: `Bearer ${config.botToken}`, 'content-type': 'application/json' },
                  body: JSON.stringify({ channel: (message.to as { channel: string }).channel, ...payload }),
                  signal,
                }),
          options,
          'slack',
        );
      } catch (cause) {
        throw new NotificationNetworkError('Unable to reach Slack.', { provider: 'slack', retryable: true, cause });
      }
      const native = webhookUrl
        ? ({ ok: response.ok, ...(response.ok ? {} : { error: await response.text() }) } as SlackResponse)
        : ((await response.json().catch(() => ({ ok: false, error: response.statusText }))) as SlackResponse);
      if (response.ok && native.ok)
        return {
          ok: true,
          provider: 'slack',
          messageId: native.ts,
          status: 'accepted',
          native,
        } satisfies NotificationResult<'slack', SlackResponse>;
      if (response.status === 401 || response.status === 403)
        throw new NotificationAuthenticationError('Slack authentication failed.', {
          provider: 'slack',
          retryable: false,
          statusCode: response.status,
          native,
        });
      if (response.status === 429)
        throw new NotificationRateLimitError('Slack rate limit exceeded.', {
          provider: 'slack',
          retryable: true,
          statusCode: 429,
          native,
        });
      throw new NotificationProviderError(native.error ?? 'Slack rejected the notification.', {
        provider: 'slack',
        retryable: response.status >= 500,
        statusCode: response.status,
        native,
      });
    },
  };
}
