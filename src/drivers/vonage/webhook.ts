import type { VonageDeliveryReceiptStatus, VonageDeliveryStatus } from "./types.js";

const receiptStatuses = new Set([
  "delivered",
  "expired",
  "failed",
  "rejected",
  "accepted",
  "buffered",
]);

/** Carrier error labels for the numeric `err-code` on failed receipts. */
const errorLabels: Record<string, string> = {
  "0": "Delivered",
  "1": "Unknown error",
  "2": "Temporary network error",
  "3": "Invalid destination address",
  "4": "Invalid message",
  "5": "Unroutable message",
  "6": "Destination unreachable",
  "7": "Subscriber age restrictions",
  "8": "Anti-spam rejection",
  "9": "Handset busy",
  "10": "Network error",
  "11": "Illegal message",
  "12": "Invalid SMSC address",
  "13": "Max message exceeded",
  "14": "MS unavailable",
  "15": "MS not SME",
  "19": "MS not provisioned",
  "20": "Invalid PDUs",
  "21": "1-way SMS disabled",
  "22": "Invalid sender address",
};

/**
 * Parses a Vonage delivery receipt (DLR) webhook. Vonage may POST receipts
 * as form-encoded bodies or JSON; both shapes are accepted.
 */
export function parseVonageDeliveryReceipt(
  payload: Readonly<Record<string, string>> | string,
): VonageDeliveryStatus {
  const record =
    typeof payload === "string" ? Object.fromEntries(new URLSearchParams(payload)) : payload;
  const messageId = record.messageId ?? record["message-id"];
  const rawStatus = record.status ?? "failed";
  if (!messageId) throw new Error("Vonage receipt is missing messageId; not a delivery receipt.");
  const errorCode = record["err-code"] || record.errCode;
  return {
    messageId,
    status: (receiptStatuses.has(rawStatus) ? rawStatus : "failed") as VonageDeliveryReceiptStatus,
    to: record.msisdn || record.to || undefined,
    from: record.from || undefined,
    networkCode: record.networkCode || undefined,
    price: record.price || undefined,
    errorCode: errorCode || undefined,
    errorLabel: errorCode ? (errorLabels[errorCode] ?? "Unknown error") : undefined,
    scts: record.scts || undefined,
    clientRef: record["client-ref"] || record.clientRef || undefined,
  };
}
