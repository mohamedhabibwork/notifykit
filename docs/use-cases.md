# Use cases

Each section is one supported use case with a short, copy-pasteable example. All imports come
from the package's public entrypoints. Provider setup details live in the [README](../README.md#provider-guides).

## 1. Send a single notification

```ts
import { createNotifier } from "@mohamedhabibwork/notifykit";

const telegram = await createNotifier({
  type: "telegram",
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
});
const result = await telegram.send({
  to: { chatId: 1234 },
  notification: { body: "Deploy complete." },
});
if (!result.ok) console.error(result.status, result.native);
```

## 2. Mobile push (FCM, APNs, Huawei)

```ts
import { createNotifier } from "@mohamedhabibwork/notifykit";

const fcm = await createNotifier({
  type: "fcm",
  credential: { serviceAccount: JSON.parse(process.env.FCM_SERVICE_ACCOUNT!) },
});
await fcm.send({
  to: { token: deviceToken },
  notification: { title: "New message", body: "You have 1 unread message." },
  data: { conversationId: "c_42" },
  priority: "high",
  ttl: 3600,
  collapseKey: "c_42",
  native: {
    // iOS tray behavior: FCM's collapseKey does not reach APNs, so set the
    // APNs equivalents explicitly or notifications stack in Notification Center.
    apns: { collapseId: "c_42", threadId: "c_42" },
  },
});
```

APNs (`type: "apns"`) and Huawei (`type: "huawei"`) use the same message model; see the README provider guides for their configuration. On a direct APNs notifier, the same tray behavior comes from the native fields, plus the iOS presentation options:

```ts
import { createApnsNotifier } from "@mohamedhabibwork/notifykit/apns";

const apns = await createApnsNotifier({
  token: { key: APNS_KEY, keyId: APNS_KEY_ID, teamId: APPLE_TEAM_ID },
});
await apns.send({
  to: { deviceToken },
  notification: { title: "New message", body: "You have 1 unread message." },
  ttl: 3600,
  collapseKey: "c_42",
  native: {
    topic: "com.example.app",
    threadId: "c_42",
    sound: "default",
    badge: 1,
    category: "MESSAGE_ACTIONS",
  },
});
```

## 3. Browser web push

```ts
const webpush = await createNotifier({
  type: "webpush",
  vapid: { subject: "mailto:ops@example.com", publicKey: VAPID_PUBLIC, privateKey: VAPID_PRIVATE },
});
await webpush.send({
  to: subscription,
  notification: { title: "Price drop", body: "Now $19" },
  ttl: 3600,
  native: { urgency: "high", topic: "price-drops" },
});
```

Core `ttl` fills `native.TTL` when unset. Failed sends report `retryable: true` for 429/5xx and `retryable: false` for 404/410 (subscription expired) so workers can prune dead subscriptions.

## 4. Email (SMTP)

```ts
const mail = await createNotifier({
  type: "email",
  transport: { type: "smtp", host: "smtp.example.com", port: 587 },
  defaults: { from: "notifications@example.com" },
});
await mail.send({ to: "user@example.com", notification: { title: "Welcome", body: "Hi there!" } });
```

Core `priority` maps to SMTP precedence headers, and `native.inReplyTo`/`references` thread replies in mail clients:

```ts
await mail.send({
  to: "user@example.com",
  notification: { title: "Payment overdue", body: "Please settle invoice #1002." },
  priority: "high",
  native: {
    html: "<p>Please settle <b>invoice #1002</b>.</p>",
    inReplyTo: "<invoice-1002@example.com>",
    references: ["<invoice-1002@example.com>"],
    attachments: [
      { filename: "invoice-1002.pdf", content: pdfBytes, contentType: "application/pdf" },
    ],
  },
});
```

## 5. Chat channels (Telegram, Slack)

```ts
import { createSlackNotifier } from "@mohamedhabibwork/notifykit/slack";

const slack = await createSlackNotifier({ webhookUrl: process.env.SLACK_WEBHOOK_URL! });
await slack.send({ to: {}, notification: { body: "Build #812 passed" } });
```

Threading and link handling are native options on both channels:

```ts
// Telegram: reply in a topic with the modern link-preview option.
await telegram.send({
  to: { chatId: "-100123456789" },
  notification: { body: 'Deploy finished — <a href="https://example.com/logs">logs</a>' },
  native: {
    parse_mode: "HTML",
    message_thread_id: 12,
    link_preview_options: { is_disabled: true },
    reply_parameters: { message_id: 418 },
  },
});

// Slack: thread follow-up with structured application metadata.
await slack.send({
  to: { channel: "C0123456789" },
  notification: { body: "Rollback triggered." },
  native: {
    thread_ts: "1727800000.000100",
    reply_broadcast: true,
    metadata: { event_type: "deploy_rollback", event_payload: { build: 812 } },
  },
});
```

## 6. Rich content: images, actions and provider-native options

```ts
await fcm.send({
  to: { token: deviceToken },
  notification: {
    title: "Order shipped",
    body: "Track it now",
    imageUrl: "https://cdn.example.com/box.png",
  },
  actions: [{ id: "track", title: "Track", url: "https://example.com/orders/1" }],
  native: {
    android: { notification: { channelId: "orders" } },
    apns: { threadId: "orders" },
  },
});
```

`native` is passed through to the provider untouched, so every provider feature stays reachable. (FCM's `native.apns` is the one exception: `collapseId` and `threadId` shorthands are normalized into the APNs `apns-collapse-id` header and `aps["thread-id"]` payload — see use case 2.)

## 7. Topic / broadcast sends

```ts
await fcm.send({
  to: { topic: "breaking-news" },
  notification: { title: "Breaking", body: "..." },
});
```

Check `notifier.capabilities.topic` before relying on it for a provider. Huawei supports topic sends and condition expressions:

```ts
await huawei.send({
  to: { condition: "'news' in topics && !('blocked' in topics)" },
  notification: { title: "Breaking", body: "..." },
});
```

## 8. Named providers with a manager (lazy init, shared lifecycle)

```ts
import { createNotificationManager } from "@mohamedhabibwork/notifykit";

const notifications = createNotificationManager({
  default: "alerts",
  providers: {
    alerts: { type: "telegram", botToken: process.env.TELEGRAM_BOT_TOKEN! },
    mail: { type: "email", transport: { type: "smtp", host: "localhost", port: 25 } },
  },
});
const alerts = await notifications.default();
await notifications.warmup(); // optional: create every provider up front
await notifications.close(); // on shutdown
```

## 9. Multi-channel delivery (same event, many channels)

```ts
await notifications.sendMulti([
  {
    provider: "alerts",
    message: { to: { chatId: 1234 }, notification: { body: "Payment received" } },
  },
  {
    provider: "mail",
    message: { to: "c@example.com", notification: { title: "Receipt", body: "Thanks!" } },
  },
]);
```

## 10. Per-user channel preferences / opt-out (new)

```ts
import { createPreferenceFilter } from "@mohamedhabibwork/notifykit";

const filter = createPreferenceFilter({
  channels: { alerts: true },
  categories: { marketing: { mail: false } }, // user unsubscribed from marketing email
});
await notifications.sendMulti(channels, { filter, category: "marketing" });
```

Missing entries default to allowed; a category rule overrides the global channel rule.

## 11. Fallback channels (new)

Try channels in order until one succeeds — e.g. push, then chat, then email.

```ts
const outcome = await notifications.sendFallback([
  { provider: "alerts", message: { to: { chatId: 1234 }, notification: { body: "OTP 9921" } } },
  { provider: "mail", message: { to: "u@example.com", notification: { body: "OTP 9921" } } },
]);
if (!outcome.result) console.error("all channels failed", outcome.errors);
else console.info("delivered via", outcome.provider);
```

Outside a manager, use `sendWithFallback([() => a.send(m1), () => b.send(m2)])`.

## 12. Batch sends with bounded concurrency

```ts
const batch = await fcm.sendMany(messages, { concurrency: 20 });
console.log(batch.successCount, batch.failureCount);
```

Providers with a native batch API (e.g. FCM) use it automatically.

## 13. Streaming bulk sends (millions of recipients)

```ts
async function* recipients() {
  for await (const user of usersCursor)
    yield { to: { token: user.token }, notification: { body: "Weekly digest" } };
}
for await (const result of fcm.sendEach(recipients(), { concurrency: 50 })) {
  if (!result.ok) await markInvalid(result.recipient);
}
```

## 14. Timeouts and cancellation

```ts
const controller = new AbortController();
await mail.send(message, { timeout: 10_000, signal: controller.signal });
```

A timeout raises `NotificationTimeoutError` (retryable).

## 15. Retries with exponential backoff (new)

```ts
import { retryMiddleware } from "@mohamedhabibwork/notifykit";

telegram.use(
  retryMiddleware({
    retries: 3,
    minDelay: 250,
    maxDelay: 10_000,
    onRetry: ({ attempt, delay }) => console.warn(`retry #${attempt} in ${delay}ms`),
  }),
);
```

Retries thrown errors whose `retryable` flag is true and `{ ok: false, retryable: true }` results.
`NotificationRateLimitError.retryAfter` (seconds) overrides the computed delay. Pass `shouldRetry` to customize.

## 16. Rate limiting / throttling (new)

```ts
import { rateLimitMiddleware } from "@mohamedhabibwork/notifykit";

telegram.use(rateLimitMiddleware({ limit: 30, interval: 1_000 })); // Telegram: ~30 msg/s
```

Excess sends wait for a free slot; nothing is dropped. The limit is per notifier, per process.

## 17. Idempotency / duplicate suppression (new)

```ts
import { dedupeMiddleware } from "@mohamedhabibwork/notifykit";

mail.use(dedupeMiddleware({ ttl: 10 * 60_000 }));
await mail.send({
  to: "u@example.com",
  idempotencyKey: `order-1001-shipped`,
  notification: { body: "Shipped" },
});
await mail.send({
  to: "u@example.com",
  idempotencyKey: `order-1001-shipped`,
  notification: { body: "Shipped" },
}); // skipped
```

Concurrent sends with the same key share one provider call; failed sends release the key. Use
`key: (ctx) => ...` to derive keys differently. For multi-instance deployments, back dedupe with a shared store in your own middleware.

## 18. Dry-run / preview mode (new)

```ts
import { dryRunMiddleware } from "@mohamedhabibwork/notifykit";

mail.use(
  dryRunMiddleware({
    enabled: () => process.env.NOTIFY_DRY_RUN === "1",
    onMessage: (message, provider) => console.info("[dry-run]", provider, message),
  }),
);
```

Returns `{ ok: true, status: "accepted", native: { dryRun: true } }` without calling the provider.

## 19. Custom middleware (telemetry, policy, redaction)

```ts
telegram.use(async (context, next) => {
  const started = performance.now();
  const result = await next();
  metrics.histogram("notify.ms", performance.now() - started, {
    provider: context.provider,
    ok: result.ok,
  });
  return result;
});
```

`context.message` exposes the outgoing message (read-only) and `context.metadata` carries `SendOptions.metadata`.
Middleware runs in registration order: the first `use()` is outermost.

## 20. Lifecycle hooks

```ts
import { Notifier } from "@mohamedhabibwork/notifykit";

const notifier = new Notifier(provider, {
  beforeSend: (ctx) => console.debug("sending", ctx.provider),
  afterSend: (ctx, result) => console.debug("sent", result.messageId),
  onError: (ctx, error) => console.error("failed", ctx.provider, error),
});
```

## 21. Error classification

```ts
import {
  NotificationRecipientError,
  isRetryableNotificationError,
} from "@mohamedhabibwork/notifykit";

try {
  await fcm.send(message);
} catch (error) {
  if (error instanceof NotificationRecipientError) await removeToken(message.to);
  else if (isRetryableNotificationError(error)) await queue.retryLater(message);
  else throw error;
}
```

## 22. Templates

```ts
import { createNotificationTemplates } from "@mohamedhabibwork/notifykit";

const templates = createNotificationTemplates({
  welcome: ({ name }: { name: string }) => ({ title: "Welcome", body: `Hi ${name}!` }),
});
await mail.send({
  to: "u@example.com",
  notification: templates.render("welcome", { name: "Sara" }),
});
```

## 23. Event routing

```ts
import { createNotificationRouter } from "@mohamedhabibwork/notifykit";

const router = createNotificationRouter({
  routes: {
    orderShipped: ({ email, chatId }: { email: string; chatId: number }) => [
      { provider: "mail" as const, message: { to: email, notification: { body: "Shipped" } } },
      {
        provider: "alerts" as const,
        message: { to: { chatId }, notification: { body: "Shipped" } },
      },
    ],
  },
});
await notifications.sendMulti(
  await router.resolve("orderShipped", { email: "u@example.com", chatId: 1 }),
);
```

## 24. Custom providers (Discord, SMS, any HTTP API)

```ts
import { defineNotificationProvider } from "@mohamedhabibwork/notifykit/custom";

const sms = defineNotificationProvider<
  "sms",
  { type: "sms"; apiKey: string },
  { phone: string },
  never,
  Response
>({
  name: "sms",
  capabilities: { single: true, batch: false, notification: true },
  async create(config) {
    return {
      name: "sms",
      capabilities: { single: true, batch: false, notification: true },
      async send(message) {
        const native = await fetch("https://sms.example.com/send", {
          method: "POST",
          headers: { authorization: `Bearer ${config.apiKey}` },
          body: JSON.stringify({ to: message.to.phone, text: message.notification?.body }),
        });
        return {
          ok: native.ok,
          provider: "sms",
          status: native.ok ? "accepted" : "failed",
          native,
        };
      },
    };
  },
});
const smsNotifier = await createNotifier({ type: "sms", apiKey: "..." }, { providers: [sms] });
```

See [custom-providers.md](custom-providers.md).

## 25. Logging

```ts
const notifications = createNotificationManager({ providers, logger: myKitLogger });
```

Any object with `debug/info/warn/error` works (e.g. loggerkit); provider creation failures are logged.

## 26. Testing without network calls

```ts
import { createFakeNotifier } from "@mohamedhabibwork/notifykit/testing";

const notifier = createFakeNotifier<{ userId: string }>();
await notifier.send({ to: { userId: "1" }, notification: { title: "Hi" } });
expect(notifier.lastMessage()?.to.userId).toBe("1");
notifier.failNext(new Error("outage"));
```

Use `createFakeDriver` to run production wiring (`createNotifier`, managers) against a recording fake.

## Not covered (by design)

- **Scheduling / delayed and recurring sends** — needs durable storage; enqueue with a job queue and call `send` from the worker.
- **Distributed rate limits and dedupe** — the built-ins are in-process; implement the same middleware contract against Redis or your database.
- **Delivery receipts / inbound webhooks** — provider-specific; read them from `result.native` or your provider's callbacks.
- **SMS/WhatsApp/Discord built-ins** — add them via a custom provider (use case 24).
