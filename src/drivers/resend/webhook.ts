import { computeHmac, timingSafeEqual, toBase64 } from "../../core/webhooks.js";
import type { ResendWebhookEvent, ResendWebhookEventType } from "./types.js";

const eventTypes = new Set([
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.opened",
  "email.clicked",
  "email.failed",
]);

/**
 * Verifies a Resend webhook using the Svix signature scheme Resend uses:
 * headers `svix-id`, `svix-timestamp`, `svix-signature`; the signed content
 * is `id.timestamp.rawBody`, HMAC-SHA256 base64, keyed with the `whsec_…`
 * signing secret. Rejects timestamps older than `toleranceSeconds` (default
 * 300) to stop replayed deliveries.
 */
export async function verifyResendWebhook(options: {
  signingSecret: string;
  rawBody: string;
  /** `svix-id` header. */
  id: string | undefined;
  /** `svix-timestamp` header (unix seconds). */
  timestamp: string | undefined;
  /** `svix-signature` header: `v1,<base64>[,…]`. */
  signatureHeader: string | undefined;
  toleranceSeconds?: number;
}): Promise<boolean> {
  if (!options.id || !options.timestamp || !options.signatureHeader) return false;
  const timestamp = Number(options.timestamp);
  if (!Number.isFinite(timestamp)) return false;
  const tolerance = options.toleranceSeconds ?? 300;
  if (Math.abs(Date.now() / 1000 - timestamp) > tolerance) return false;
  const expected = toBase64(
    await computeHmac(
      "SHA-256",
      options.signingSecret.replace(/^whsec_/, ""),
      `${options.id}.${options.timestamp}.${options.rawBody}`,
    ),
  );
  for (const part of options.signatureHeader.split(" ")) {
    const [version, signature] = part.split(",");
    if (version !== "v1" || !signature) continue;
    if (timingSafeEqual(expected, signature)) return true;
  }
  return false;
}

/**
 * Parses a Resend webhook event body. `emailId` matches the `id` returned
 * by the send call, so results can be joined back to notifications.
 */
export function parseResendWebhookEvent(payload: unknown): ResendWebhookEvent {
  const typed = (payload ?? {}) as {
    type?: string;
    created_at?: string;
    data?: { email_id?: string; to?: readonly string[]; from?: string; subject?: string };
  };
  if (!typed.type) throw new Error("Resend webhook payload is missing a type; not a Resend event.");
  const known = eventTypes.has(typed.type);
  if (!known) throw new Error(`Unknown Resend event type "${typed.type}".`);
  return {
    type: typed.type as ResendWebhookEventType,
    createdAt: typed.created_at,
    emailId: typed.data?.email_id,
    to: typed.data?.to,
    from: typed.data?.from,
    subject: typed.data?.subject,
    raw: payload as Record<string, unknown>,
  };
}
