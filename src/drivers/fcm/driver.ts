import { importOptional } from '../../core/dynamic-import.js';
import { NotificationConfigError, NotificationProviderError } from '../../core/errors.js';
import type { NotificationProvider } from '../../core/provider.js';
import type {
  BatchNotificationResult,
  NotificationMessage,
  NotificationResult,
  SendOptions,
} from '../../core/types.js';
import { withTimeout } from '../../core/utils.js';
import type { FcmConfig } from './config.js';
import type { FcmAccessToken, FcmNativeClient, FcmNativeOptions, FcmRecipient, FcmResponse } from './types.js';
type FirebaseApp = { name?: string };
type FirebaseCredential = {
  getAccessToken(): Promise<{ access_token: string; expires_in?: number }>;
};
type FcmBatchResponse = { responses: Array<{ success: boolean; messageId?: string; error?: unknown }> };
type FirebaseMessaging = {
  send(message: Record<string, unknown>): Promise<string>;
  sendEach?(messages: Record<string, unknown>[]): Promise<FcmBatchResponse>;
  sendEachForMulticast?(message: Record<string, unknown>): Promise<FcmBatchResponse>;
};
export async function createFcmProvider(
  config: FcmConfig,
): Promise<NotificationProvider<'fcm', FcmRecipient, FcmConfig, FcmNativeOptions, FcmResponse>> {
  let admin: {
    initializeApp(options: unknown, name?: string): FirebaseApp;
    cert(value: unknown): FirebaseCredential;
    app?(name?: string): FirebaseApp;
    messaging(app?: FirebaseApp): FirebaseMessaging;
  };
  try {
    admin = (await importOptional('firebase-admin')) as typeof admin;
  } catch (cause) {
    throw new NotificationConfigError(
      'FCM provider requires "firebase-admin". Install it with: npm install firebase-admin',
      { provider: 'fcm', retryable: false, cause },
    );
  }
  const credential = 'serviceAccount' in config.credential ? config.credential.serviceAccount : config.credential;
  const firebaseCredential = admin.cert(credential);
  let app: FirebaseApp;
  try {
    app =
      config.appName && admin.app
        ? admin.app(config.appName)
        : admin.initializeApp(
            {
              credential: firebaseCredential,
              projectId: 'projectId' in credential ? credential.projectId : undefined,
            },
            config.appName,
          );
  } catch {
    app = admin.initializeApp({ credential: firebaseCredential }, config.appName);
  }
  const messaging = admin.messaging(app);
  const refreshSkewMs = config.auth?.refreshSkewMs ?? 30_000;
  if (!Number.isFinite(refreshSkewMs) || refreshSkewMs < 0)
    throw new NotificationConfigError('FCM auth.refreshSkewMs must be a non-negative finite number.', {
      provider: 'fcm',
      retryable: false,
    });
  let localAccessToken: FcmAccessToken | undefined;
  const getAccessToken = async (): Promise<FcmAccessToken> => {
    const externalToken = await config.auth?.tokenCache?.get();
    const cached = [localAccessToken, externalToken]
      .filter((token): token is FcmAccessToken => token != null && token.expiresAt > Date.now() + refreshSkewMs)
      .sort((left, right) => right.expiresAt - left.expiresAt)[0];
    if (cached) return cached;
    const native = await firebaseCredential.getAccessToken();
    const expiresInMs = Math.max(0, native.expires_in ?? 300) * 1000;
    const token = { accessToken: native.access_token, expiresAt: Date.now() + expiresInMs };
    localAccessToken = token;
    await config.auth?.tokenCache?.set(token);
    return token;
  };
  const toNative = (message: NotificationMessage<FcmRecipient, FcmNativeOptions>): Record<string, unknown> => {
    const target =
      'token' in message.to
        ? { token: message.to.token }
        : 'tokens' in message.to
          ? { tokens: message.to.tokens }
          : 'topic' in message.to
            ? { topic: message.to.topic }
            : 'condition' in message.to
              ? { condition: message.to.condition }
              : {};
    return {
      ...target,
      notification: message.notification && {
        title: message.notification.title,
        body: message.notification.body,
        imageUrl: message.notification.imageUrl,
      },
      data:
        message.data && Object.fromEntries(Object.entries(message.data).map(([key, value]) => [key, String(value)])),
      android: message.native?.android,
      apns: message.native?.apns,
      webpush: message.native?.webpush,
      fcmOptions: message.native?.fcmOptions,
    };
  };
  const provider: NotificationProvider<'fcm', FcmRecipient, FcmConfig, FcmNativeOptions, FcmResponse> = {
    name: 'fcm',
    capabilities: {
      single: true,
      batch: true,
      token: true,
      topic: true,
      condition: true,
      notification: true,
      data: true,
      image: true,
      ttl: true,
      priority: true,
    },
    native: (): FcmNativeClient => ({ app, messaging, getAccessToken }),
    async send(message, options?: SendOptions): Promise<NotificationResult<'fcm', FcmResponse>> {
      try {
        const payload = toNative(message);
        if ('tokens' in message.to) {
          if (!messaging.sendEachForMulticast)
            throw new NotificationProviderError('Installed firebase-admin does not support multicast delivery.', {
              provider: 'fcm',
              retryable: false,
            });
          const native = await withTimeout(() => messaging.sendEachForMulticast!(payload), options, 'fcm');
          const sent = native.responses.filter((response) => response.success);
          return {
            ok: sent.length === native.responses.length,
            provider: 'fcm',
            messageId: sent[0]?.messageId,
            status: sent.length ? 'accepted' : 'failed',
            retryable: false,
            native,
          };
        }
        const messageId = await withTimeout(() => messaging.send(payload), options, 'fcm');
        return { ok: true, provider: 'fcm', messageId, status: 'accepted', native: { messageId } };
      } catch (cause) {
        if (cause instanceof NotificationProviderError) throw cause;
        throw new NotificationProviderError('FCM rejected the notification.', {
          provider: 'fcm',
          retryable: false,
          cause,
        });
      }
    },
    async sendMany(messages, options?: SendOptions): Promise<BatchNotificationResult<'fcm', FcmResponse>> {
      if (!messaging.sendEach || messages.some((message) => 'tokens' in message.to)) {
        const results = await Promise.all(messages.map((message) => provider.send(message, options)));
        return {
          provider: 'fcm',
          total: results.length,
          successCount: results.filter((result) => result.ok).length,
          failureCount: results.filter((result) => !result.ok).length,
          results,
        };
      }
      try {
        const native = await withTimeout(() => messaging.sendEach!(messages.map(toNative)), options, 'fcm');
        const results = native.responses.map((response) => ({
          ok: response.success,
          provider: 'fcm' as const,
          messageId: response.messageId,
          status: response.success ? ('accepted' as const) : ('failed' as const),
          retryable: false,
          native: response,
        }));
        return {
          provider: 'fcm',
          total: results.length,
          successCount: results.filter((result) => result.ok).length,
          failureCount: results.filter((result) => !result.ok).length,
          results,
        };
      } catch (cause) {
        throw new NotificationProviderError('FCM batch request failed.', { provider: 'fcm', retryable: false, cause });
      }
    },
  };
  return provider;
}
