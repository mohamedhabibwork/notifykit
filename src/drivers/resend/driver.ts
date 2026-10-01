import {
  NotificationAuthenticationError,
  NotificationConfigError,
  NotificationNetworkError,
  NotificationPayloadError,
  NotificationRateLimitError,
  NotificationProviderError,
} from "../../core/errors.js";
import type { NotificationProvider } from "../../core/provider.js";
import type { NotificationMessage, NotificationResult, SendOptions } from "../../core/types.js";
import { assertSecureEndpoint, withTimeout } from "../../core/utils.js";
import type { ResendConfig } from "./config.js";
import type {
  ResendAddress,
  ResendNativeOptions,
  ResendRecipient,
  ResendResponse,
} from "./types.js";
import { serializeResendAddress, serializeResendAddressList } from "./types.js";

const toBase64Content = (content: string | Uint8Array): string =>
  typeof content === "string"
    ? content
    : btoa(
        String.fromCharCode(
          ...new Uint8Array(content.buffer, content.byteOffset, content.byteLength),
        ),
      );

export async function createResendProvider(
  config: ResendConfig,
): Promise<
  NotificationProvider<"resend", ResendRecipient, ResendConfig, ResendNativeOptions, ResendResponse>
> {
  if (!config.apiKey)
    throw new NotificationConfigError("Resend provider requires an apiKey.", {
      provider: "resend",
      retryable: false,
    });
  const apiUrl = assertSecureEndpoint(
    (config.apiUrl ?? "https://api.resend.com").replace(/\/$/, ""),
    "Resend",
  );
  const endpoint = `${apiUrl}/emails`;
  return {
    name: "resend",
    capabilities: {
      single: true,
      batch: false,
      notification: true,
      data: false,
      image: true,
      actions: false,
    },
    native: () => ({ endpoint }),
    async send(
      message: NotificationMessage<ResendRecipient, ResendNativeOptions>,
      options?: SendOptions,
    ): Promise<NotificationResult<"resend", ResendResponse>> {
      const native = message.native ?? {};
      const from = native.from ?? (config.defaultFrom as ResendAddress | undefined);
      if (!from)
        throw new NotificationPayloadError(
          "Resend messages require a sender: set config.defaultFrom or native.from.",
          { provider: "resend", retryable: false },
        );
      const text = native.text ?? message.notification?.body;
      const html = native.html;
      if (!text && !html)
        throw new NotificationPayloadError(
          "Resend messages require a body, native.text, or native.html.",
          { provider: "resend", retryable: false },
        );
      const body = {
        from: serializeResendAddress(from),
        to: serializeResendAddressList(message.to),
        subject: message.notification?.title,
        text,
        html,
        reply_to: native.replyTo ? serializeResendAddressList(native.replyTo) : undefined,
        cc: native.cc ? serializeResendAddressList(native.cc) : undefined,
        bcc: native.bcc ? serializeResendAddressList(native.bcc) : undefined,
        headers: native.headers,
        attachments: native.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: toBase64Content(attachment.content),
          content_type: attachment.contentType,
        })),
        tags: native.tags,
        scheduled_at: native.scheduledAt,
      };
      let response: Response;
      try {
        response = await withTimeout(
          (signal) =>
            fetch(endpoint, {
              method: "POST",
              headers: {
                authorization: `Bearer ${config.apiKey}`,
                "content-type": "application/json",
              },
              body: JSON.stringify(body),
              signal,
            }),
          options,
          "resend",
        );
      } catch (cause) {
        throw new NotificationNetworkError("Unable to reach the Resend API.", {
          provider: "resend",
          retryable: true,
          cause,
        });
      }
      const nativeResponse = (await response.json().catch(() => ({}))) as ResendResponse;
      if (response.ok && nativeResponse.id)
        return {
          ok: true,
          provider: "resend",
          messageId: nativeResponse.id,
          status: "accepted",
          native: nativeResponse,
        };
      if (response.status === 401 || response.status === 403)
        throw new NotificationAuthenticationError(
          nativeResponse.message ?? "Resend authentication failed.",
          {
            provider: "resend",
            retryable: false,
            statusCode: response.status,
            native: nativeResponse,
          },
        );
      if (response.status === 429)
        throw new NotificationRateLimitError(
          nativeResponse.message ?? "Resend rate limit exceeded.",
          {
            provider: "resend",
            retryable: true,
            statusCode: 429,
            retryAfter: (() => {
              const retryAfter = response.headers.get("retry-after");
              return retryAfter != null ? Number(retryAfter) * 1000 : undefined;
            })(),
            native: nativeResponse,
          },
        );
      if (response.status === 422 || nativeResponse.name === "validation_error")
        throw new NotificationPayloadError(
          nativeResponse.message ?? "Resend rejected the email payload.",
          {
            provider: "resend",
            retryable: false,
            statusCode: response.status,
            native: nativeResponse,
          },
        );
      throw new NotificationProviderError(nativeResponse.message ?? "Resend rejected the email.", {
        provider: "resend",
        retryable: response.status >= 500,
        statusCode: response.status,
        native: nativeResponse,
      });
    },
  };
}
