import {
  NotificationAuthenticationError,
  NotificationConfigError,
  NotificationNetworkError,
  NotificationPayloadError,
  NotificationRateLimitError,
  NotificationRecipientError,
  NotificationProviderError,
} from "../../core/errors.js";
import type { NotificationProvider } from "../../core/provider.js";
import type { NotificationMessage, NotificationResult, SendOptions } from "../../core/types.js";
import { assertSecureEndpoint, withTimeout } from "../../core/utils.js";
import type { VonageConfig } from "./config.js";
import type { VonageNativeOptions, VonageRecipient, VonageResponse } from "./types.js";

/**
 * Vonage SMS API status codes (always HTTP 200; the per-message `status`
 * field carries the outcome): 1 throttled, 9 quota exceeded, 10 too many
 * binds are rate limits; 2 missing/3 invalid parameters are caller
 * mistakes; 4 invalid credentials; 6 invalid message (unreachable or
 * blocked destination); 5 internal errors retry.
 */
const rateLimitStatuses = new Set(["1", "9", "10"]);

export async function createVonageProvider(
  config: VonageConfig,
): Promise<
  NotificationProvider<"vonage", VonageRecipient, VonageConfig, VonageNativeOptions, VonageResponse>
> {
  if (!config.apiKey)
    throw new NotificationConfigError("Vonage provider requires an apiKey.", {
      provider: "vonage",
      retryable: false,
    });
  if (!config.apiSecret)
    throw new NotificationConfigError("Vonage provider requires an apiSecret.", {
      provider: "vonage",
      retryable: false,
    });
  const apiUrl = assertSecureEndpoint(
    (config.apiUrl ?? "https://rest.nexmo.com").replace(/\/$/, ""),
    "Vonage",
  );
  const endpoint = `${apiUrl}/sms/json`;
  return {
    name: "vonage",
    capabilities: {
      single: true,
      batch: false,
      data: true,
      image: false,
      notification: false,
      actions: false,
    },
    native: () => ({ endpoint }),
    async send(
      message: NotificationMessage<VonageRecipient, VonageNativeOptions>,
      options?: SendOptions,
    ): Promise<NotificationResult<"vonage", VonageResponse>> {
      const to = message.to.phoneNumber;
      if (!/^\d{1,20}$/.test(to))
        throw new NotificationRecipientError(
          "Vonage recipients must be E.164 digits without the leading plus, e.g. 15551234567.",
          { provider: "vonage", retryable: false, recipient: to },
        );
      const text = message.notification?.body ?? message.notification?.title ?? "";
      if (!text)
        throw new NotificationPayloadError(
          "Vonage messages require notification.body or native.text content.",
          { provider: "vonage", retryable: false },
        );
      const body = {
        api_key: config.apiKey,
        api_secret: config.apiSecret,
        from: message.native?.from ?? config.defaultFrom,
        to,
        text,
        ...message.native,
      };
      let response: Response;
      try {
        response = await withTimeout(
          (signal) =>
            fetch(endpoint, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                accept: "application/json",
              },
              body: JSON.stringify(body),
              signal,
            }),
          options,
          "vonage",
        );
      } catch (cause) {
        throw new NotificationNetworkError("Unable to reach the Vonage SMS API.", {
          provider: "vonage",
          retryable: true,
          cause,
        });
      }
      const native = (await response.json().catch(() => ({}))) as VonageResponse;
      const result = native.messages?.[0];
      const status = result?.status;
      if (response.ok && status === "0" && result?.["message-id"])
        return {
          ok: true,
          provider: "vonage",
          messageId: result["message-id"],
          recipient: result.to,
          status: "accepted",
          native,
        };
      if (status == null)
        throw new NotificationProviderError(
          response.ok ? "Vonage returned no message outcome." : response.statusText,
          {
            provider: "vonage",
            retryable: response.status >= 500,
            statusCode: response.status,
            native,
          },
        );
      if (status === "4")
        throw new NotificationAuthenticationError(
          result?.["error-text"] ?? "Vonage rejected the credentials.",
          { provider: "vonage", retryable: false, code: status, native },
        );
      if (rateLimitStatuses.has(status))
        throw new NotificationRateLimitError(
          result?.["error-text"] ?? "Vonage rate limit exceeded.",
          { provider: "vonage", retryable: true, code: status, native },
        );
      if (status === "2" || status === "3")
        throw new NotificationPayloadError(
          result?.["error-text"] ?? "Vonage rejected the message parameters.",
          { provider: "vonage", retryable: false, code: status, native },
        );
      if (status === "6")
        throw new NotificationRecipientError(
          result?.["error-text"] ?? "Vonage cannot deliver to this recipient.",
          { provider: "vonage", retryable: false, code: status, native },
        );
      throw new NotificationProviderError(
        result?.["error-text"] ?? "Vonage rejected the message.",
        {
          provider: "vonage",
          retryable: status === "5" || response.status >= 500,
          code: status,
          native,
        },
      );
    },
  };
}
