# Resend Email API

Resend's HTTP email API — no SMTP connection, plain `fetch` with a bearer key. Entrypoint: `@mohamedhabibwork/notifykit/resend`.

Use this when you don't want a long-lived SMTP socket ([`email`](email.md) covers SMTP via nodemailer).

## Configuration

| Option        | Required | Description                                                                                                                                             |
| ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiKey`      | yes      | Resend API key (starts with `re_`).                                                                                                                     |
| `defaultFrom` | no       | Default From address (string or `{ email, name }`); per-message `native.from` wins. A sender is required per message — set it here or in `native.from`. |
| `apiUrl`      | no       | API base URL; defaults to `https://api.resend.com`.                                                                                                     |

Recipients are strings, `{ email, name }` objects, or arrays of both — same shape as the SMTP email driver.

## Sending email

```ts
import { createResendNotifier } from "@mohamedhabibwork/notifykit/resend";

const resend = await createResendNotifier({
  apiKey: process.env.RESEND_API_KEY!,
  defaultFrom: { name: "Acme Alerts", email: "alerts@example.test" },
});

const result = await resend.send({
  to: [{ email: "user@example.test", name: "Ada" }, "ops@example.test"],
  notification: { title: "Deploy finished", body: "Build #812 passed" },
});
console.log(result.messageId); // Resend email id — join webhook events on this
```

HTML bodies, threading, headers, attachments, and tags go through `native`:

```ts
await resend.send({
  to: "user@example.test",
  notification: { title: "Weekly digest" },
  native: {
    html: "<h1>Digest</h1><p>Everything shipped.</p>",
    replyTo: "support@example.test",
    headers: { "X-Campaign": "digest-41" },
    tags: [{ name: "kind", value: "digest" }],
    attachments: [{ filename: "log.txt", content: new TextEncoder().encode("hello") }],
    scheduledAt: "2026-10-02T09:00:00Z",
  },
});
```

## Delivery webhooks (Svix-signed)

Configure events (`email.sent`, `email.delivered`, `email.bounced`, …) in the Resend dashboard and copy the signing secret. Verification follows the Svix scheme — reject anything older than the tolerance to stop replays:

```ts
import { parseResendWebhookEvent, verifyResendWebhook } from "@mohamedhabibwork/notifykit/resend";

app.post("/webhooks/resend", express.raw({ type: "*/*" }), async (req, res) => {
  const rawBody = req.body.toString("utf8");
  const verified = await verifyResendWebhook({
    signingSecret: process.env.RESEND_WEBHOOK_SECRET!, // whsec_…
    rawBody,
    id: req.header("svix-id"),
    timestamp: req.header("svix-timestamp"),
    signatureHeader: req.header("svix-signature"),
  });
  if (!verified) return res.sendStatus(401);
  const event = parseResendWebhookEvent(JSON.parse(rawBody));
  // { type: "email.delivered" | "email.bounced" | …, emailId, to, from, subject, createdAt }
  await deliveries.record(event.emailId!, event.type); // emailId === send result.messageId
  res.sendStatus(200);
});
```

## Errors, retries, and rate limits

| Resend outcome                  | Thrown error                                            | Retryable |
| ------------------------------- | ------------------------------------------------------- | --------- |
| HTTP 401/403                    | `NotificationAuthenticationError`                       | no        |
| HTTP 429 (honors `Retry-After`) | `NotificationRateLimitError`                            | yes       |
| HTTP 422 / `validation_error`   | `NotificationPayloadError`                              | no        |
| HTTP 5xx                        | `NotificationProviderError`                             | yes       |
| Transport failure / timeout     | `NotificationNetworkError` / `NotificationTimeoutError` | yes       |

```ts
import { retryMiddleware } from "@mohamedhabibwork/notifykit";
resend.use(retryMiddleware({ maxAttempts: 3 }));
```

## Full example

Transactional fan-out across channels — pair `resend` with a push or SMS provider through `createNotificationManager` (`sendMulti` to hit every channel, `sendFallback` to escalate); see [examples.md](examples.md) sections 2 and 7 and [providers.md](providers.md).
