# Vonage SMS API

Vonage (Nexmo) classic SMS REST API. Fetch-based — no SDK, no extra dependency. Entrypoint: `@mohamedhabibwork/notifykit/vonage`.

Vonage returns HTTP 200 even for failures — the per-message `status` field carries the outcome, and the driver translates it to typed errors. Handset delivery arrives later as a delivery-receipt (DLR) webhook.

## Configuration

| Option        | Required | Description                                                                |
| ------------- | -------- | -------------------------------------------------------------------------- |
| `apiKey`      | yes      | Vonage API key from the dashboard.                                         |
| `apiSecret`   | yes      | Vonage API secret; sent only to the configured API host.                   |
| `defaultFrom` | no       | Default sender ID (alphanumeric or E.164); per-message `native.from` wins. |
| `apiUrl`      | no       | REST base URL; defaults to `https://rest.nexmo.com`.                       |

Recipients are `{ phoneNumber }` — E.164 digits **without** a leading `+`.

## Sending SMS

```ts
import { createVonageNotifier } from "@mohamedhabibwork/notifykit/vonage";

const vonage = await createVonageNotifier({
  apiKey: process.env.VONAGE_API_KEY!,
  apiSecret: process.env.VONAGE_API_SECRET!,
  defaultFrom: "Acme",
});

const result = await vonage.send({
  to: { phoneNumber: "15551234567" },
  notification: { body: "Your code is 1234" },
});
console.log(result.messageId); // "0A000000…" — matches the DLR messageId
```

Unicode content, TTL, and other SMS API fields pass through `native`:

```ts
await vonage.send({
  to: { phoneNumber: "15551234567" },
  notification: { body: "Grüße von Acme" },
  native: { type: "unicode", ttl: 900_000 },
});
```

## Delivery receipts (DLR webhooks)

Set the DLR webhook URL in the Vonage dashboard (SMS settings). Receipts arrive form-encoded or as JSON — the parser accepts both:

```ts
import { parseVonageDeliveryReceipt } from "@mohamedhabibwork/notifykit/vonage";

app.post("/webhooks/vonage/dlr", express.urlencoded({ extended: false }), async (req, res) => {
  const receipt = parseVonageDeliveryReceipt(req.body);
  // { messageId, status: "delivered"|"expired"|"failed"|"rejected"|"accepted"|"buffered",
  //   to, from, networkCode, price, errorCode, errorLabel, scts, clientRef }
  await deliveries.record(receipt.messageId, receipt.status, receipt.errorLabel);
  res.sendStatus(200);
});
```

Vonage's SMS DLRs carry no shared-secret signature — restrict the endpoint (network controls, unguessable path) and validate `messageId` against sends you actually made before acting on a receipt.

## Errors, retries, and rate limits

Vonage reports outcomes as per-message statuses; the driver maps them:

| Status         | Meaning                   | Thrown error                      | Retryable |
| -------------- | ------------------------- | --------------------------------- | --------- |
| `0`            | Accepted                  | — (returns a result)              | —         |
| `1`, `9`, `10` | Throttled / quota / binds | `NotificationRateLimitError`      | yes       |
| `2`, `3`       | Missing / invalid params  | `NotificationPayloadError`        | no        |
| `4`            | Invalid credentials       | `NotificationAuthenticationError` | no        |
| `5`            | Internal error            | `NotificationProviderError`       | yes       |
| `6`            | Unreachable destination   | `NotificationRecipientError`      | no        |
| other          | Provider rejection        | `NotificationProviderError`       | no        |

```ts
import { retryMiddleware } from "@mohamedhabibwork/notifykit";
vonage.use(retryMiddleware({ maxAttempts: 3 })); // status 1 throttling is retryable
```

## Full example

SMS with Twilio→Vonage fallback channels — see [examples.md, section 7](examples.md#7-sms-with-fallback-channels-twilio-then-vonage).
