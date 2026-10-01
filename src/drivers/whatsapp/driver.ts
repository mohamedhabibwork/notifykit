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
import type { WhatsAppConfig } from "./config.js";
import type { WhatsAppNativeOptions, WhatsAppRecipient, WhatsAppResponse } from "./types.js";

/**
 * Cloud API error codes treated as caller mistakes (bad number, template, or
 * payload) — never retried. Codes 4/80007/130429/131048/133016 are
 * throttling/throughput and map to NotificationRateLimitError instead.
 */
const recipientErrorCodes = new Set([100, 131026, 131030, 131047, 131049, 132000, 133000]);

const rateLimitCodes = new Set([4, 80007, 130429, 131048, 133016]);

export async function createWhatsAppProvider(
  config: WhatsAppConfig,
): Promise<
  NotificationProvider<
    "whatsapp",
    WhatsAppRecipient,
    WhatsAppConfig,
    WhatsAppNativeOptions,
    WhatsAppResponse
  >
> {
  if (!config.phoneNumberId || typeof config.phoneNumberId !== "string")
    throw new NotificationConfigError("WhatsApp provider requires a phoneNumberId.", {
      provider: "whatsapp",
      retryable: false,
    });
  if (!config.accessToken)
    throw new NotificationConfigError("WhatsApp provider requires an accessToken.", {
      provider: "whatsapp",
      retryable: false,
    });
  const apiVersion = config.apiVersion ?? "v23.0";
  const apiUrl = assertSecureEndpoint(
    (config.apiUrl ?? "https://graph.facebook.com").replace(/\/$/, ""),
    "WhatsApp",
  );
  const endpoint = `${apiUrl}/${apiVersion}/${config.phoneNumberId}/messages`;
  return {
    name: "whatsapp",
    capabilities: {
      single: true,
      batch: false,
      data: true,
      image: true,
      notification: false,
      actions: false,
    },
    native: () => ({ endpoint: (method: string) => `${endpoint}/${method}` }),
    async send(
      message: NotificationMessage<WhatsAppRecipient, WhatsAppNativeOptions>,
      options?: SendOptions,
    ): Promise<NotificationResult<"whatsapp", WhatsAppResponse>> {
      const to = message.to.phoneNumber;
      if (!/^\d{1,20}$/.test(to))
        throw new NotificationRecipientError(
          "WhatsApp recipients must be E.164 digits without the leading plus, e.g. 15551234567.",
          {
            provider: "whatsapp",
            retryable: false,
            recipient: to,
          },
        );
      const native = message.native ?? {};
      const body: Record<string, unknown> = native.type
        ? { messaging_product: "whatsapp", recipient_type: "individual", to, ...native }
        : {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to,
            type: "text",
            text: {
              body: message.notification?.body ?? message.notification?.title ?? "",
              ...(native.text?.preview_url != null ? { preview_url: native.text.preview_url } : {}),
            },
          };
      if (body.type === "text" && !(body.text as { body?: string } | undefined)?.body)
        throw new NotificationPayloadError(
          "WhatsApp messages require notification.body or a native text/template payload.",
          {
            provider: "whatsapp",
            retryable: false,
          },
        );
      let response: Response;
      try {
        response = await withTimeout(
          (signal) =>
            fetch(endpoint, {
              method: "POST",
              headers: {
                authorization: `Bearer ${config.accessToken}`,
                "content-type": "application/json",
              },
              body: JSON.stringify(body),
              signal,
            }),
          options,
          "whatsapp",
        );
      } catch (cause) {
        throw new NotificationNetworkError("Unable to reach the WhatsApp Cloud API.", {
          provider: "whatsapp",
          retryable: true,
          cause,
        });
      }
      const nativeResponse = (await response.json().catch(() => ({}))) as WhatsAppResponse;
      const error = nativeResponse.error;
      if (response.ok && nativeResponse.messages?.[0]?.id)
        return {
          ok: true,
          provider: "whatsapp",
          messageId: nativeResponse.messages[0].id,
          recipient: nativeResponse.contacts?.[0]?.wa_id,
          status: "accepted",
          native: nativeResponse,
        };
      if (response.status === 401 || response.status === 403 || error?.code === 190)
        throw new NotificationAuthenticationError(
          error?.message ?? "WhatsApp Cloud API authentication failed.",
          {
            provider: "whatsapp",
            retryable: false,
            statusCode: response.status,
            native: nativeResponse,
          },
        );
      if (
        response.status === 429 ||
        response.headers.get("retry-after") != null ||
        (error?.code != null && rateLimitCodes.has(error.code))
      ) {
        const retryAfterHeader = response.headers.get("retry-after");
        throw new NotificationRateLimitError(
          error?.message ?? "WhatsApp Cloud API rate limit exceeded.",
          {
            provider: "whatsapp",
            retryable: true,
            statusCode: response.status,
            retryAfter: retryAfterHeader != null ? Number(retryAfterHeader) * 1000 : undefined,
            native: nativeResponse,
          },
        );
      }
      const code = error?.code;
      if (code != null && recipientErrorCodes.has(code))
        throw new NotificationRecipientError(error?.message ?? "WhatsApp recipient rejected.", {
          provider: "whatsapp",
          retryable: false,
          statusCode: response.status,
          code: String(code),
          native: nativeResponse,
        });
      throw new NotificationProviderError(
        error?.error_data?.details ?? error?.message ?? "WhatsApp Cloud API rejected the message.",
        {
          provider: "whatsapp",
          retryable: response.status >= 500,
          statusCode: response.status,
          code: code != null ? String(code) : undefined,
          native: nativeResponse,
        },
      );
    },
  };
}
