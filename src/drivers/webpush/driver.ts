import { importOptional } from "../../core/dynamic-import.js";
import { NotificationConfigError, NotificationProviderError } from "../../core/errors.js";
import type { NotificationProvider } from "../../core/provider.js";
import type { NotificationMessage, NotificationResult, SendOptions } from "../../core/types.js";
import type { WebPushConfig } from "./config.js";
import type { WebPushNativeOptions, WebPushRecipient, WebPushResponse } from "./types.js";
type WebPushClient = {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  sendNotification(
    subscription: unknown,
    payload?: string,
    options?: object,
  ): Promise<{ statusCode?: number; headers?: Record<string, string>; body?: string }>;
};
export async function createWebPushProvider(
  config: WebPushConfig,
): Promise<
  NotificationProvider<
    "webpush",
    WebPushRecipient,
    WebPushConfig,
    WebPushNativeOptions,
    WebPushResponse
  >
> {
  let module: unknown;
  try {
    module = await importOptional("web-push");
  } catch (cause) {
    throw new NotificationConfigError(
      'Web Push provider requires "web-push". Install it with: npm install web-push',
      {
        provider: "webpush",
        retryable: false,
        cause,
      },
    );
  }
  const client = ((module as { default?: WebPushClient }).default ?? module) as WebPushClient;
  client.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
  return {
    name: "webpush",
    capabilities: {
      single: true,
      batch: false,
      token: true,
      notification: true,
      data: true,
      ttl: true,
      priority: true,
    },
    native: () => client,
    async send(
      message: NotificationMessage<WebPushRecipient, WebPushNativeOptions>,
      _options?: SendOptions,
    ): Promise<NotificationResult<"webpush", WebPushResponse>> {
      try {
        const options = { ...message.native };
        if (options.TTL == null && message.ttl != null) options.TTL = message.ttl;
        const native = await client.sendNotification(
          message.to,
          JSON.stringify({
            notification: message.notification,
            data: message.data,
            actions: message.actions,
          }),
          options,
        );
        return { ok: true, provider: "webpush", status: "accepted", native };
      } catch (cause) {
        const statusCode = (cause as { statusCode?: number }).statusCode;
        throw new NotificationProviderError("Web Push delivery request failed.", {
          provider: "webpush",
          // 429 and 5xx are transient; 404/410 mean the subscription is gone.
          retryable: statusCode === 429 || (statusCode != null && statusCode >= 500),
          cause,
        });
      }
    },
  };
}
