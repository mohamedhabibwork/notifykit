import { computeHmac, timingSafeEqual, toBase64 } from "../../core/webhooks.js";
import type { TwilioCallbackStatus, TwilioDeliveryStatus } from "./types.js";

const callbackStatuses = new Set([
  "queued",
  "accepted",
  "sent",
  "delivered",
  "undelivered",
  "failed",
  "read",
]);

/**
 * Parses a Twilio status callback. Twilio posts the parameters
 * form-encoded (`MessageSid`, `MessageStatus`, …); pass them as a record,
 * e.g. from `new URLSearchParams(await request.text())` entries.
 */
export function parseTwilioStatusCallback(
  params: Readonly<Record<string, string>> | string,
): TwilioDeliveryStatus {
  const record =
    typeof params === "string" ? Object.fromEntries(new URLSearchParams(params)) : params;
  const sid = record.MessageSid ?? record.SmsSid ?? record.CallSid ?? "";
  if (!sid)
    throw new Error("Twilio callback is missing MessageSid; not a message status callback.");
  const rawStatus = record.MessageStatus ?? record.SmsStatus ?? "failed";
  const status = (callbackStatuses.has(rawStatus) ? rawStatus : "failed") as TwilioCallbackStatus;
  const to = record.To ?? "";
  return {
    messageSid: sid,
    status,
    to: to || undefined,
    from: record.From || undefined,
    channelPrefix: to.startsWith("whatsapp:") ? "whatsapp" : undefined,
    whatsapp: to.startsWith("whatsapp:"),
    errorCode: record.ErrorCode != null ? Number(record.ErrorCode) : undefined,
    errorMessage: record.ErrorMessage || undefined,
  };
}

/**
 * Verifies the `X-Twilio-Signature` header: base64 HMAC-SHA1 over the full
 * callback URL plus every POST parameter sorted alphabetically
 * (`key + value` concatenated), keyed with the auth token.
 */
export async function verifyTwilioSignature(options: {
  authToken: string;
  /** The full public URL Twilio called, scheme and query included. */
  url: string;
  /** POST parameters; `sig` is ignored if present. */
  params: Readonly<Record<string, string>> | string;
  /** The `X-Twilio-Signature` header value. */
  signatureHeader: string | undefined;
}): Promise<boolean> {
  if (!options.signatureHeader) return false;
  const record =
    typeof options.params === "string"
      ? Object.fromEntries(new URLSearchParams(options.params))
      : options.params;
  let data = options.url;
  for (const key of Object.keys(record).toSorted()) {
    if (key === "sig") continue;
    data += key + record[key];
  }
  const expected = toBase64(await computeHmac("SHA-1", options.authToken, data));
  return timingSafeEqual(expected, options.signatureHeader);
}
