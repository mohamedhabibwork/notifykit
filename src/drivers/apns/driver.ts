import { importOptional } from '../../core/dynamic-import.js';
import { NotificationConfigError, NotificationProviderError } from '../../core/errors.js';
import type { NotificationProvider } from '../../core/provider.js';
import type { NotificationMessage, NotificationResult, SendOptions } from '../../core/types.js';
import type { ApnsConfig } from './config.js';
import type { ApnsNativeOptions, ApnsRecipient, ApnsResponse } from './types.js';
type Provider = { send(note: unknown, tokens: string | readonly string[]): Promise<ApnsResponse>; shutdown?(): void };
type Notification = {
  topic?: string;
  expiry?: number;
  priority?: number;
  collapseId?: string;
  pushType?: string;
  alert?: { title?: string; body?: string };
  payload?: Record<string, unknown>;
};
export async function createApnsProvider(
  config: ApnsConfig,
): Promise<NotificationProvider<'apns', ApnsRecipient, ApnsConfig, ApnsNativeOptions, ApnsResponse>> {
  let module: unknown;
  try {
    module = await importOptional('@parse/node-apn');
  } catch (cause) {
    throw new NotificationConfigError(
      'APNs provider requires "@parse/node-apn". Install it with: npm install @parse/node-apn',
      { provider: 'apns', retryable: false, cause },
    );
  }
  const apn = ((module as { default?: Record<string, unknown> }).default ?? module) as {
    Provider: new (options: unknown) => Provider;
    Notification: new () => Notification;
  };
  const client = new apn.Provider({
    token: { key: config.token.key, keyId: config.token.keyId, teamId: config.token.teamId },
    production: config.production ?? false,
  });
  return {
    name: 'apns',
    capabilities: { single: true, batch: true, token: true, notification: true, data: true, ttl: true, priority: true },
    native: () => client,
    async send(
      message: NotificationMessage<ApnsRecipient, ApnsNativeOptions>,
      _options?: SendOptions,
    ): Promise<NotificationResult<'apns', ApnsResponse>> {
      const note = new apn.Notification();
      const native = message.native;
      note.topic = native?.topic;
      note.expiry = native?.expiration;
      note.priority = native?.priority;
      note.collapseId = native?.collapseId ?? message.collapseKey;
      note.pushType = native?.pushType;
      note.alert = message.notification && { title: message.notification.title, body: message.notification.body };
      note.payload = { ...message.data, ...native?.payload };
      try {
        const response = await client.send(
          note,
          'deviceToken' in message.to ? message.to.deviceToken : message.to.deviceTokens,
        );
        return {
          ok: !response.failed?.length,
          provider: 'apns',
          status: response.failed?.length ? 'failed' : 'accepted',
          retryable: false,
          native: response,
        };
      } catch (cause) {
        throw new NotificationProviderError('APNs rejected the notification.', {
          provider: 'apns',
          retryable: true,
          cause,
        });
      }
    },
    close: () => client.shutdown?.(),
  };
}
