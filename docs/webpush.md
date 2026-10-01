# Web Push

Standards-based browser push (VAPID, aes128gcm) to subscribed browsers. SDK-backed — the optional peer `web-push` loads only when the notifier is created. Entrypoint: `@mohamedhabibwork/notifykit/webpush`.

## Installation

```sh
npm install @mohamedhabibwork/notifykit web-push
```

## Configuration

| Option  | Required | Description                                                                           |
| ------- | -------- | ------------------------------------------------------------------------------------- |
| `vapid` | yes      | `{ subject, publicKey, privateKey }` — your `mailto:` subject and the VAPID key pair. |

Recipients are push subscriptions as your client stored them:

```ts
type WebPushRecipient = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};
```

## Sending

```ts
import { createWebPushNotifier } from "@mohamedhabibwork/notifykit/webpush";

const webpush = await createWebPushNotifier({
  vapid: {
    subject: "mailto:ops@example.test",
    publicKey: process.env.VAPID_PUBLIC_KEY!,
    privateKey: process.env.VAPID_PRIVATE_KEY!,
  },
});

const result = await webpush.send({
  to: subscription, // stored PushSubscription JSON
  notification: { title: "Order shipped", body: "Track your parcel", imageUrl: "https://…" },
  data: { orderId: "812" }, // encrypted payload
  ttl: 3600, // derives the TTL header
  native: {
    urgency: "normal", // very-low | low | normal | high
    topic: "order-812", // replaces matching pending messages
  },
});
```

A 404/410 from the push service means the subscription is gone — the driver surfaces this as a non-retryable failure; delete the subscription then.

```ts
try {
  await webpush.send({ to: subscription, notification: { body: "hi" } });
} catch (error) {
  if (error instanceof NotificationError && !error.retryable)
    await subscriptions.remove(subscription.endpoint);
  throw error;
}
```

## Errors, retries, and rate limits

| Push service outcome                      | Thrown error                | Retryable         |
| ----------------------------------------- | --------------------------- | ----------------- |
| HTTP 429 or 5xx from the push service     | `NotificationProviderError` | yes (429 and 5xx) |
| 404/410 (expired subscription), other 4xx | `NotificationProviderError` | no                |
| Missing `web-push` package                | `NotificationConfigError`   | no                |
| Transport failure                         | `NotificationNetworkError`  | yes               |

```ts
import { retryMiddleware } from "@mohamedhabibwork/notifykit";
webpush.use(retryMiddleware({ maxAttempts: 3 }));
```

## Full example

Subscription storage and send flow — see [use-cases.md](use-cases.md) and [providers.md](providers.md).
