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
import type { TwilioConfig } from "./config.js";
import type { TwilioNativeOptions, TwilioRecipient, TwilioResponse } from "./types.js";

/** Caller-mistake codes: invalid/blacklisted recipient or missing body. */
const recipientErrorCodes = new Set([21211, 21606, 21610, 21612, 21614]);

const payloadErrorCodes = new Set([21602, 21605]);

export async function createTwilioProvider(
  config: TwilioConfig,
): Promise<
  NotificationProvider<"twilio", TwilioRecipient, TwilioConfig, TwilioNativeOptions, TwilioResponse>
> {
  if (!/^AC[a-f0-9]{32}$/i.test(config.accountSid))
    throw new NotificationConfigError(
      'Twilio provider requires an accountSid shaped like "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".',
      { provider: "twilio", retryable: false },
    );
  if (!config.authToken)
    throw new NotificationConfigError("Twilio provider requires an authToken.", {
      provider: "twilio",
      retryable: false,
    });
  const apiUrl = assertSecureEndpoint(
    (config.apiUrl ?? "https://api.twilio.com").replace(/\/$/, ""),
    "Twilio",
  );
  const endpoint = `${apiUrl}/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const authorization = `Basic ${btoa(`${config.accountSid}:${config.authToken}`)}`;
  return {
    name: "twilio",
    capabilities: {
      single: true,
      batch: false,
      data: true,
      image: true,
      notification: false,
      actions: false,
    },
    native: () => ({ endpoint }),
    async send(
      message: NotificationMessage<TwilioRecipient, TwilioNativeOptions>,
      options?: SendOptions,
    ): Promise<NotificationResult<"twilio", TwilioResponse>> {
      const to = message.to.phoneNumber;
      if (!/^(whatsapp:)?\+\d{1,20}$/.test(to))
        throw new NotificationRecipientError(
          'Twilio recipients must be E.164 ("+15551234567"), optionally prefixed with "whatsapp:".',
          { provider: "twilio", retryable: false, recipient: to },
        );
      const body = message.notification?.body ?? message.notification?.title ?? "";
      const params = new URLSearchParams();
      params.set("To", to);
      const from = message.native?.from ?? config.from;
      const messagingServiceSid = message.native?.messagingServiceSid ?? config.messagingServiceSid;
      if (from) params.set("From", from);
      else if (messagingServiceSid) params.set("MessagingServiceSid", messagingServiceSid);
      else
        throw new NotificationConfigError(
          "Twilio messages require a sender: set config.from, config.messagingServiceSid, or native.from.",
          { provider: "twilio", retryable: false },
        );
      if (body) params.set("Body", body);
      if (message.native?.contentSid) {
        params.set("ContentSid", message.native.contentSid);
        if (message.native.contentVariables)
          params.set("ContentVariables", JSON.stringify(message.native.contentVariables));
      }
      if (message.native?.mediaUrl)
        for (const url of message.native.mediaUrl) params.append("MediaUrl", url);
      const statusCallback = message.native?.statusCallback ?? config.statusCallbackUrl;
      if (statusCallback) params.set("StatusCallback", statusCallback);
      for (const [key, value] of Object.entries(message.native ?? {})) {
        if (
          key === "from" ||
          key === "messagingServiceSid" ||
          key === "statusCallback" ||
          key === "mediaUrl" ||
          key === "contentSid" ||
          key === "contentVariables" ||
          value == null
        )
          continue;
        params.set(key, String(value));
      }
      let response: Response;
      try {
        response = await withTimeout(
          (signal) =>
            fetch(endpoint, {
              method: "POST",
              headers: { authorization, "content-type": "application/x-www-form-urlencoded" },
              body: params.toString(),
              signal,
            }),
          options,
          "twilio",
        );
      } catch (cause) {
        throw new NotificationNetworkError("Unable to reach the Twilio API.", {
          provider: "twilio",
          retryable: true,
          cause,
        });
      }
      const native = (await response.json().catch(() => ({}))) as TwilioResponse;
      if (response.ok && native.sid)
        return {
          ok: true,
          provider: "twilio",
          messageId: native.sid,
          recipient: native.to,
          status: "accepted",
          native,
        };
      if (response.status === 401 || native.code === 20003)
        throw new NotificationAuthenticationError(
          native.message ?? "Twilio authentication failed.",
          {
            provider: "twilio",
            retryable: false,
            statusCode: response.status,
            native,
          },
        );
      const retryAfterHeader = response.headers.get("retry-after");
      if (response.status === 429 || native.code === 20429)
        throw new NotificationRateLimitError(native.message ?? "Twilio rate limit exceeded.", {
          provider: "twilio",
          retryable: true,
          statusCode: 429,
          retryAfter: retryAfterHeader != null ? Number(retryAfterHeader) * 1000 : undefined,
          native,
        });
      if (native.code != null && recipientErrorCodes.has(native.code))
        throw new NotificationRecipientError(native.message ?? "Twilio recipient rejected.", {
          provider: "twilio",
          retryable: false,
          statusCode: response.status,
          code: String(native.code),
          native,
        });
      if (native.code != null && payloadErrorCodes.has(native.code))
        throw new NotificationPayloadError(native.message ?? "Twilio rejected the message body.", {
          provider: "twilio",
          retryable: false,
          statusCode: response.status,
          code: String(native.code),
          native,
        });
      throw new NotificationProviderError(native.message ?? "Twilio rejected the message.", {
        provider: "twilio",
        retryable: response.status >= 500,
        statusCode: response.status,
        code: native.code != null ? String(native.code) : undefined,
        native,
      });
    },
  };
}
