# Twilio Messaging (SMS and WhatsApp)

Twilio Programmable Messaging REST API. Fetch-based — no SDK, no extra dependency. Entrypoint: `@mohamedhabibwork/notifykit/twilio`.

One driver covers both SMS and WhatsApp: prefix the recipient (and optionally the sender) with `whatsapp:`. Templates use Twilio Content API SIDs.

## Configuration

| Option                | Required | Description                                                                                         |
| --------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `accountSid`          | yes      | Account SID, shaped `AC…` (validated at creation).                                                  |
| `authToken`           | yes      | Auth token from the Twilio console; also keys webhook signature checks.                             |
| `from`                | one of   | Default sender: E.164, short code, alphanumeric sender ID, or `whatsapp:+…`.                        |
| `messagingServiceSid` | one of   | Messaging Service SID; used when `from` is absent. Per message needs a sender, so set at least one. |
| `statusCallbackUrl`   | no       | Default `StatusCallback` for delivery status; per-message override via `native.statusCallback`.     |
| `apiUrl`              | no       | REST base URL; defaults to `https://api.twilio.com`.                                                |

Recipients are `{ phoneNumber }` — E.164 (`+15551234567`) or `whatsapp:+15551234567`.

## Sending SMS and WhatsApp

```ts
import { createTwilioNotifier } from "@mohamedhabibwork/notifykit/twilio";

const twilio = await createTwilioNotifier({
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
  messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!,
  statusCallbackUrl: "https://example.test/webhooks/twilio",
});

// SMS
const result = await twilio.send({
  to: { phoneNumber: "+15551234567" },
  notification: { body: "Your code is 1234" },
});
console.log(result.messageId); // "SM…" — join status callbacks on this sid

// WhatsApp channel — same driver, prefixed numbers
await twilio.send({
  to: { phoneNumber: "whatsapp:+15551234567" },
  notification: { body: "Your code is 1234" },
});
```

MMS, validity windows, smart encoding, and other Messages-resource parameters pass through `native`:

```ts
await twilio.send({
  to: { phoneNumber: "+15551234567" },
  notification: { body: "Invoice attached" },
  native: {
    mediaUrl: ["https://example.test/invoice.pdf"],
    validityPeriod: 3600,
    provideFeedback: true,
  },
});
```

## Templates (Content API)

```ts
await twilio.send({
  to: { phoneNumber: "whatsapp:+15551234567" },
  native: {
    contentSid: "HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    contentVariables: { code: "1234" }, // JSON-encoded into ContentVariables
  },
});
```

## Status callbacks

Twilio POSTs form-encoded parameters to the configured `StatusCallback` URL. Verify `X-Twilio-Signature` — HMAC-SHA1 over the full public URL plus the POST parameters sorted alphabetically — then parse:

```ts
import {
  parseTwilioStatusCallback,
  verifyTwilioSignature,
} from "@mohamedhabibwork/notifykit/twilio";

app.post("/webhooks/twilio", express.urlencoded({ extended: false }), async (req, res) => {
  const params = req.body as Record<string, string>;
  const verified = await verifyTwilioSignature({
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    url: `${process.env.PUBLIC_BASE_URL}/webhooks/twilio`, // must match the URL Twilio called
    params,
    signatureHeader: req.header("x-twilio-signature"),
  });
  if (!verified) return res.sendStatus(403);
  const status = parseTwilioStatusCallback(params);
  // { messageSid, status: "queued"…"delivered"|"undelivered"|"failed",
  //   to, from, whatsapp, errorCode, errorMessage }
  await deliveries.record(status.messageSid, status.status, status.errorMessage);
  res.sendStatus(200);
});
```

## Errors, retries, and rate limits

| Twilio outcome                                                                  | Thrown error                                            | Retryable |
| ------------------------------------------------------------------------------- | ------------------------------------------------------- | --------- |
| HTTP 401 or code `20003`                                                        | `NotificationAuthenticationError`                       | no        |
| HTTP 429 or code `20429` (honors `Retry-After`)                                 | `NotificationRateLimitError`                            | yes       |
| Codes `21211`, `21606`, `21610`, `21612`, `21614` (invalid/opted-out recipient) | `NotificationRecipientError`                            | no        |
| Codes `21602`, `21605` (missing body/sender)                                    | `NotificationPayloadError`                              | no        |
| HTTP 5xx                                                                        | `NotificationProviderError`                             | yes       |
| Transport failure / timeout                                                     | `NotificationNetworkError` / `NotificationTimeoutError` | yes       |

```ts
import { retryMiddleware } from "@mohamedhabibwork/notifykit";
twilio.use(retryMiddleware({ maxAttempts: 3 }));
```

## Full example

SMS with Twilio→Vonage fallback channels — see [examples.md, section 7](examples.md#7-sms-with-fallback-channels-twilio-then-vonage).
