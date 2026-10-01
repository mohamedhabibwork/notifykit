# WhatsApp Business Cloud API

Official Meta WhatsApp messaging through the Cloud API. Fetch-based — no SDK, no extra dependency. Entrypoint: `@mohamedhabibwork/notifykit/whatsapp`.

Meta only delivers freeform text inside the 24-hour customer service window; everything else requires an approved template, which is why template sends are first-class in `native`.

## Configuration

| Option          | Required | Description                                                              |
| --------------- | -------- | ------------------------------------------------------------------------ |
| `phoneNumberId` | yes      | WhatsApp Business phone number ID (Graph API resource id).               |
| `accessToken`   | yes      | System-user token with `whatsapp_business_messaging`.                    |
| `apiVersion`    | no       | Graph API version segment; defaults to `v23.0`.                          |
| `apiUrl`        | no       | Graph API base URL; defaults to `https://graph.facebook.com`.            |
| `appSecret`     | no       | Required only to verify webhook payloads with `verifyWhatsAppSignature`. |

Recipients are `{ phoneNumber }` — E.164 digits **without** a leading `+` (Meta rejects `+15551234567`; use `15551234567`).

## Sending text and templates

```ts
import { createWhatsAppNotifier } from "@mohamedhabibwork/notifykit/whatsapp";

const whatsapp = await createWhatsAppNotifier({
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
});

// Freeform text — only inside the 24-hour customer service window.
const result = await whatsapp.send({
  to: { phoneNumber: "15551234567" },
  notification: { body: "Your ride is arriving now" },
  native: { text: { preview_url: true } },
});
console.log(result.messageId); // "wamid.…"
```

```ts
// Approved template with body parameters — required outside the service window.
await whatsapp.send({
  to: { phoneNumber: "15551234567" },
  native: {
    type: "template",
    template: {
      name: "order_update",
      language: { code: "en_US" },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: "812" }],
        },
      ],
    },
  },
});
```

Media, stickers, locations, contacts, interactive buttons, and reactions pass through `native` exactly as the Cloud API defines them (set `native.type` and the matching field); the driver builds the `messaging_product`/`recipient_type`/`to` envelope.

## Delivery status webhooks

Configure the webhook URL in the Meta App Dashboard (Webhooks → `messages` field). Verify the `X-Hub-Signature-256` header with your **app secret**, then flatten the envelope:

```ts
import {
  parseWhatsAppWebhookEvent,
  verifyWhatsAppSignature,
} from "@mohamedhabibwork/notifykit/whatsapp";

app.post("/webhooks/whatsapp", express.raw({ type: "*/*" }), async (req, res) => {
  const rawBody = req.body.toString("utf8");
  const verified = await verifyWhatsAppSignature({
    appSecret: process.env.WHATSAPP_APP_SECRET!,
    rawBody,
    signatureHeader: req.header("x-hub-signature-256"),
  });
  if (!verified) return res.sendStatus(401);
  for (const status of parseWhatsAppWebhookEvent(JSON.parse(rawBody)))
    // status: { messageId, status: "sent" | "delivered" | "read" | "failed" | "deleted",
    //           timestamp, recipientPhone, errors, conversation, pricing }
    await deliveries.record(status.messageId, status.status, status.errors?.[0]?.message);
  res.sendStatus(200);
});
```

`parseWhatsAppWebhookEvent` skips inbound customer messages (`messages` entries); read those from the raw payload if you also receive replies.

## Errors, retries, and rate limits

| Cloud API outcome                                                                                                   | Thrown error                                            | Retryable |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------- |
| HTTP 401/403 or error code `190` (expired/invalid token)                                                            | `NotificationAuthenticationError`                       | no        |
| 429, `Retry-After` header, codes `4`, `80007`, `130429`, `131048`, `133016`                                         | `NotificationRateLimitError` (with `retryAfter` ms)     | yes       |
| Codes `100`, `131026`, `131030`, `131047`, `131049`, `132000`, `133000` (bad number/template, re-engagement window) | `NotificationRecipientError`                            | no        |
| HTTP 5xx                                                                                                            | `NotificationProviderError`                             | yes       |
| Transport failure / timeout                                                                                         | `NotificationNetworkError` / `NotificationTimeoutError` | yes       |

Wire the shared policies for automatic behavior:

```ts
import { retryMiddleware, rateLimitMiddleware } from "@mohamedhabibwork/notifykit";

whatsapp.use(rateLimitMiddleware({ maxPerSecond: 80 })); // Cloud API tier limits
whatsapp.use(retryMiddleware({ maxAttempts: 3 })); // retries only `retryable` failures
```

## Full example

Order-shipped template send plus a verified webhook receiver — see [examples.md, section 6](examples.md#6-whatsapp-cloud-api-send-with-verified-delivery-webhooks).

```ts
const outcome = await notifications.sendFallback([
  {
    provider: "whatsapp",
    message: {
      to: { phoneNumber: "15551234567" },
      native: {
        type: "template",
        template: { name: "order_update", language: { code: "en_US" }, components: [] },
      },
    },
  },
  {
    provider: "twilio",
    message: { to: { phoneNumber: "+15551234567" }, notification: { body: "Order 812 shipped" } },
  },
]);
// Falls back to SMS when the template send fails (e.g. expired token).
```
