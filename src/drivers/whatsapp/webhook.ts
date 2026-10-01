import { computeHmac, timingSafeEqual, toHex } from "../../core/webhooks.js";
import type { WhatsAppDeliveryStatus, WhatsAppWebhookStatus } from "./types.js";

interface WhatsAppWebhookPayload {
  object?: string;
  entry?: readonly {
    id?: string;
    changes?: readonly {
      field?: string;
      value?: {
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        statuses?: readonly {
          id?: string;
          status?: string;
          timestamp?: string;
          recipient_id?: string;
          conversation?: Record<string, unknown>;
          pricing?: Record<string, unknown>;
          errors?: readonly Record<string, unknown>[];
        }[];
      };
    }[];
  }[];
}

const webhookStatuses = new Set(["sent", "delivered", "read", "failed", "deleted"]);

/**
 * Flattens a Cloud API webhook payload into delivery-status entries. Inbound
 * message entries (`messages`, not `statuses`) are skipped; parse them from
 * the raw payload directly if you also receive customer messages.
 */
export function parseWhatsAppWebhookEvent(
  payload: WhatsAppWebhookPayload | unknown,
): readonly WhatsAppDeliveryStatus[] {
  const typed = payload as WhatsAppWebhookPayload;
  const statuses: WhatsAppDeliveryStatus[] = [];
  for (const entry of typed.entry ?? [])
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      for (const status of change.value?.statuses ?? []) {
        if (!status.id) continue;
        const normalized = (
          webhookStatuses.has(status.status ?? "") ? status.status : "failed"
        ) as WhatsAppWebhookStatus;
        statuses.push({
          messageId: status.id,
          status: normalized,
          timestamp: Number(status.timestamp ?? 0),
          recipientPhone: status.recipient_id,
          conversation: status.conversation,
          pricing: status.pricing,
          errors: status.errors as WhatsAppDeliveryStatus["errors"],
        });
      }
    }
  return statuses;
}

/**
 * Verifies the `X-Hub-Signature-256` header Meta sends with every webhook
 * delivery: `sha256=` + hex HMAC-SHA256 of the exact raw request body keyed
 * with the app secret. `rawBody` must be the unparsed body string.
 */
export async function verifyWhatsAppSignature(options: {
  appSecret: string;
  rawBody: string;
  /** The `X-Hub-Signature-256` header value. */
  signatureHeader: string | undefined;
}): Promise<boolean> {
  if (!options.signatureHeader?.startsWith("sha256=")) return false;
  const expected = `sha256=${toHex(await computeHmac("SHA-256", options.appSecret, options.rawBody))}`;
  return timingSafeEqual(expected, options.signatureHeader);
}
