# @mohamedhabibwork/notifykit

[![npm version](https://img.shields.io/npm/v/@mohamedhabibwork/notifykit)](https://www.npmjs.com/package/@mohamedhabibwork/notifykit)
[![npm downloads](https://img.shields.io/npm/dm/@mohamedhabibwork/notifykit)](https://www.npmjs.com/package/@mohamedhabibwork/notifykit)
[![Latest Release](https://img.shields.io/github/v/release/mohamedhabibwork/notifykit)](https://github.com/mohamedhabibwork/notifykit/releases/latest)
[![License: MIT](https://img.shields.io/npm/l/@mohamedhabibwork/notifykit)](./LICENSE)
[![GitHub: @mohamedhabibwork](https://img.shields.io/badge/GitHub-@mohamedhabibwork-181717?logo=github&logoColor=white)](https://github.com/mohamedhabibwork)
[![Node.js >= 20](https://img.shields.io/node/v/@mohamedhabibwork/notifykit)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![CI](https://github.com/mohamedhabibwork/notifykit/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mohamedhabibwork/notifykit/actions/workflows/ci.yml)
[![Runtime smoke tests](https://github.com/mohamedhabibwork/notifykit/actions/workflows/runtimes.yml/badge.svg?branch=main)](https://github.com/mohamedhabibwork/notifykit/actions/workflows/runtimes.yml)
[![CodeQL](https://github.com/mohamedhabibwork/notifykit/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/mohamedhabibwork/notifykit/actions/workflows/codeql.yml)
[![Socket](https://badge.socket.dev/npm/package/@mohamedhabibwork/notifykit)](https://socket.dev/npm/package/@mohamedhabibwork/notifykit)

> Unified TypeScript notifications across push, web push, email, messaging, and custom providers—with strongly typed native provider options preserved instead of flattened into a lowest-common-denominator API.

NotifyKit gives applications one small notification contract while keeping advanced provider capabilities under `native`. Change the configured provider and TypeScript changes the valid recipient shape, native payload, response type, and capabilities with it.

Every supported use case, with a runnable example, is listed in [docs/use-cases.md](docs/use-cases.md).

## Features

- First-party FCM, Huawei Push Kit, Web Push, SMTP email, Telegram, Slack, APNs, WhatsApp Business Cloud API, Twilio, Vonage SMS, and Resend email providers.
- Native provider options and responses remain fully accessible and typed.
- Optional peer dependencies: installing one provider does not load every provider SDK.
- Node.js 20+, Bun, and Deno-compatible fetch-based core.
- Lazy, strongly typed named provider instances through `NotificationManager`.
- Middleware, hooks, timeout/cancellation, batch sends, typed errors, and clean lifecycle handling.
- Public custom-provider contract and a fake notifier for tests.

## Installation

```sh
npm install @mohamedhabibwork/notifykit
# bun add @mohamedhabibwork/notifykit
# deno add npm:@mohamedhabibwork/notifykit
```

Install a provider SDK only when you use that provider:

| Provider                        | Entrypoint                             | Additional dependency         |
| ------------------------------- | -------------------------------------- | ----------------------------- |
| Firebase Cloud Messaging        | `@mohamedhabibwork/notifykit/fcm`      | `npm install firebase-admin`  |
| Huawei Push Kit                 | `@mohamedhabibwork/notifykit/huawei`   | None (`fetch`)                |
| Web Push                        | `@mohamedhabibwork/notifykit/webpush`  | `npm install web-push`        |
| SMTP email                      | `@mohamedhabibwork/notifykit/email`    | `npm install nodemailer`      |
| Telegram Bot API                | `@mohamedhabibwork/notifykit/telegram` | None (`fetch`)                |
| Apple Push Notification service | `@mohamedhabibwork/notifykit/apns`     | `npm install @parse/node-apn` |
| Slack                           | `@mohamedhabibwork/notifykit/slack`    | None (`fetch`)                |
| WhatsApp Business Cloud API     | `@mohamedhabibwork/notifykit/whatsapp` | None (`fetch`)                |
| Twilio Messaging (SMS/WhatsApp) | `@mohamedhabibwork/notifykit/twilio`   | None (`fetch`)                |
| Vonage SMS API                  | `@mohamedhabibwork/notifykit/vonage`   | None (`fetch`)                |
| Resend Email API                | `@mohamedhabibwork/notifykit/resend`   | None (`fetch`)                |

The provider entrypoints are tree-shakeable. SDK-backed drivers dynamically load their peer dependency only when you create the matching notifier.

Each provider has a dedicated guide — configuration, templates, delivery-status callbacks, error handling, and full examples: [docs/providers.md](docs/providers.md) indexes them ([whatsapp](docs/whatsapp.md), [twilio](docs/twilio.md), [vonage](docs/vonage.md), [resend](docs/resend.md), [fcm](docs/fcm.md), [huawei](docs/huawei.md), [webpush](docs/webpush.md), [email](docs/email.md), [telegram](docs/telegram.md), [apns](docs/apns.md), [slack](docs/slack.md)).

## Framework integration

A notifier is a plain async `send()` call, so NotifyKit drops into any framework. Ready-made recipes:

| Framework            | Recipe                           |
| -------------------- | -------------------------------- |
| Express 4/5          | notification route               |
| Fastify 4/5          | plugin + named providers         |
| NestJS 10+           | injectable notifications service |
| Hono 4               | route handler                    |
| Next.js (App Router) | server-side route handler        |
| Elysia (Bun)         | shared async instance            |

See [framework integration](docs/frameworks.md) and [end-to-end examples](docs/examples.md) for copy-paste snippets.

## Quick start

The root factory infers the notifier from `type`:

```ts
import { createNotifier } from "@mohamedhabibwork/notifykit";

const notifier = await createNotifier({
  type: "telegram",
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
});

const result = await notifier.send({
  to: { chatId: 123456789 },
  notification: { body: "<b>Deployment complete</b>" },
  native: { parse_mode: "HTML", disable_notification: false },
});

console.log(result.provider); // 'telegram'
console.log(result.messageId);
console.log(result.native); // native Telegram response
```

For the smallest provider-only import, use the provider subpath instead:

```ts
import { createTelegramNotifier } from "@mohamedhabibwork/notifykit/telegram";

const notifier = await createTelegramNotifier({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
});
```

### Slack and webhook channels

Slack supports either a bot token (to send to a channel) or an incoming webhook. Incoming webhooks are a convenient bridge for other channel-style integrations; use the custom-provider API when their payload differs from Slack's format.

```ts
import { createSlackNotifier } from "@mohamedhabibwork/notifykit/slack";

const slack = await createSlackNotifier({ botToken: process.env.SLACK_BOT_TOKEN! });
await slack.send({
  to: { channel: "C0123456789" },
  notification: { body: "Deployment complete." },
  native: {
    blocks: [{ type: "section", text: { type: "mrkdwn", text: "*Deployment complete*" } }],
  },
});
```

Additional native options: `thread_ts`/`reply_broadcast` (threading), `attachments`, `unfurl_links`/`unfurl_media`, `username`/`icon_emoji`/`icon_url` (webhook identity), `as_user`, `link_names`, `parse`, and `metadata` for structured application metadata.

### Streaming bulk sends

Pass an iterable or async iterable to `sendEach` to keep only the configured number of in-flight messages in memory. Results are yielded as soon as each send completes. `sendMany` also accepts generators, but it collects all results before returning for backwards compatibility.

```ts
async function* recipients() {
  for await (const user of users) {
    yield { to: { channel: user.slackChannel }, notification: { body: "Weekly update" } };
  }
}

for await (const result of slack.sendEach(recipients(), { concurrency: 20 })) {
  if (!result.ok) console.error(result.native);
}
```

## Message model

Every notifier accepts the same small common shape. `to` and `native` are provider-specific.

```ts
await notifier.send({
  to: /* provider recipient */,
  notification: {
    title: 'Order shipped',
    body: 'Your order is on its way.',
    imageUrl: 'https://cdn.example.com/order.jpg',
  },
  data: { orderId: 'ORD-1001' },
  actions: [{ id: 'view-order', title: 'View order', url: 'https://example.com/orders/ORD-1001' }],
  collapseKey: 'order-ORD-1001',
  ttl: 3600,
  priority: 'high',
  idempotencyKey: 'order-shipped-ORD-1001',
  native: {
    /* provider-specific options */
  },
});
```

The common `data` property is delivered to the provider. Use `SendOptions.metadata` for tracing, tenancy, or audit values that must never leave your application.

The generic `collapseKey`, `ttl`, and `priority` fields map to each push provider's native equivalent by default (FCM/Huawei Android config, APNs `collapseId`/`expiry`, Web Push `TTL`, email SMTP precedence); a matching `native.*` field always overrides them. See the provider guides below for the exact mapping.

## Provider guides

### Firebase Cloud Messaging

```ts
import { createFcmNotifier } from "@mohamedhabibwork/notifykit/fcm";

const fcm = await createFcmNotifier({
  credential: {
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_PRIVATE_KEY!,
  },
  appName: "notifications",
});

await fcm.send({
  to: { token: "fcm-device-token" },
  notification: { title: "New message", body: "Mohamed sent you a message." },
  data: { conversationId: "123" },
  priority: "high",
  ttl: 3600,
  collapseKey: "conversation-123",
  native: {
    apns: {
      collapseId: "conversation-123",
      threadId: "conversation-123",
      payload: { aps: { sound: "default", mutableContent: true } },
      fcmOptions: { imageUrl: "https://cdn.example.com/order-image.png" },
    },
  },
});

await fcm.send({
  to: { tokens: ["token-a", "token-b"] },
  notification: { title: "Maintenance window" },
});
```

Recipients may be `{ token }`, `{ tokens }`, `{ topic }`, or `{ condition }`. `fcm.native()` returns the Firebase Messaging client.

Core-level `priority`, `ttl`, and `collapseKey` default into the Android config (`android.priority`, `android.ttl`, `android.collapseKey`) unless `native.android` overrides them.

### Access tokens and mutable content

For rich iOS notifications, use `native.apns.payload.aps.mutableContent: true` together with `native.apns.fcmOptions.imageUrl`. This enables the app's Notification Service Extension to process the attachment before display. `fcm.native()` also exposes `getAccessToken()` for direct, authenticated FCM HTTP v1 calls when the SDK abstraction is insufficient.

For iOS tray behavior, use `native.apns.collapseId` (sent as the `apns-collapse-id` header — notifications sharing it replace each other instead of stacking) and `native.apns.threadId` (sent as `thread-id` in the `aps` payload — groups related notifications in Notification Center). FCM's `android.collapseKey` does not apply to iOS.

```ts
const native = fcm.native();
const token = await native?.getAccessToken();

await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${token?.accessToken}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({ message: { token: "device-token", data: { event: "sync" } } }),
});
```

FCM credentials already cache tokens internally. Pass `auth.tokenCache` to share NotifyKit's developer-facing token cache across notifier instances; cached tokens refresh before `expiresAt`, using `auth.refreshSkewMs` (30 seconds by default).

### Huawei Push Kit

Huawei Push Kit uses standard `fetch` and caches the OAuth token in memory by default. Provide a `tokenCache` to persist it in your own cache.

```ts
import { createHuaweiNotifier } from "@mohamedhabibwork/notifykit/huawei";

const huawei = await createHuaweiNotifier({
  appId: process.env.HUAWEI_APP_ID!,
  appSecret: process.env.HUAWEI_APP_SECRET!,
});

await huawei.send({
  to: { token: "huawei-device-token" },
  notification: { title: "New message", body: "You have a new message." },
  native: {
    android: {
      notification: {
        click_action: { type: 1, intent: "app://messages" },
      },
    },
  },
});
```

Recipients may be `{ token }`, `{ tokens }`, `{ topic }`, or `{ condition }` — a Push Kit condition expression such as `"'news' in topics && ('sports' in topics || !('health' in topics))"`.

Huawei tokens are cached according to the OAuth `expires_in` duration. Use the native token client for a custom Huawei API request, or provide a cache for reuse across notifier instances:

```ts
const cache = {
  async get() {
    return redis.get("huawei-access-token");
  },
  async set(token: { accessToken: string; expiresAt: number }) {
    await redis.set("huawei-access-token", token);
  },
};

const huawei = await createHuaweiNotifier({
  appId,
  appSecret,
  auth: { tokenCache: cache, refreshSkewMs: 30_000 },
});

const token = await huawei.native()?.getAccessToken();
```

For a Huawei iOS payload that requires a Notification Service Extension, set `native.apns.payload.aps.mutableContent: true` (or the raw APNs `'mutable-content': 1` spelling).

### Web Push

```ts
import { createWebPushNotifier } from "@mohamedhabibwork/notifykit/webpush";

const webpush = await createWebPushNotifier({
  vapid: {
    subject: "mailto:admin@example.com",
    publicKey: process.env.VAPID_PUBLIC_KEY!,
    privateKey: process.env.VAPID_PRIVATE_KEY!,
  },
});

await webpush.send({
  to: { endpoint: subscription.endpoint, keys: subscription.keys },
  notification: { title: "Update available", body: "Open the app to update." },
  data: { url: "/updates/100" },
  native: { TTL: 60, urgency: "high", topic: "updates" },
});
```

`native.TTL`, `native.urgency`, `native.topic`, `native.headers`, and `native.contentEncoding` map 1:1 to the `web-push` library's options. Core-level `ttl` fills in `TTL` when `native.TTL` is not set. Delivery failures are classified by HTTP status: 429 and 5xx come back as retryable, 404/410 (expired subscription) as permanent.

### SMTP email

```ts
import { createEmailNotifier } from "@mohamedhabibwork/notifykit/email";

const email = await createEmailNotifier({
  transport: {
    type: "smtp",
    host: process.env.SMTP_HOST!,
    port: 587,
    secure: false,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
  },
  defaults: { from: { email: "notifications@example.com", name: "Example App" } },
});

await email.send({
  to: { email: "customer@example.com", name: "Customer" },
  notification: { title: "Invoice ready", body: "Your invoice is ready." },
  native: {
    html: "<h1>Invoice ready</h1><p>Your invoice is ready.</p>",
    replyTo: "support@example.com",
    headers: { "X-Application": "api" },
  },
});
```

An email recipient may be a string, `{ email, name? }`, or a readonly list of either. A message needs `notification.body`, `native.text`, or `native.html`.

Core-level `priority` maps to the SMTP precedence headers (`"high"` sets `Importance`/`Priority`, `"low"` sets `Precedence: bulk`); `native.priority` overrides it. For mail-client threading, set `native.inReplyTo` and `native.references`. Attachments accept `filename`, `content`, `contentType`, `cid` (for inline images in `native.html`), and `encoding`.

### Telegram

```ts
import { createTelegramNotifier } from "@mohamedhabibwork/notifykit/telegram";

const telegram = await createTelegramNotifier({ botToken: process.env.TELEGRAM_BOT_TOKEN! });

await telegram.send({
  to: { chatId: "-100123456789" },
  notification: { body: "<b>Server CPU passed 90%</b>" },
  native: {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "Open dashboard", url: "https://example.com/dashboard" }]],
    },
  },
});
```

Use `{ chatId }` for a chat or `{ channel }` for a channel. Supported native options include `parse_mode`, `entities`, `link_preview_options` (the official replacement for the deprecated `disable_web_page_preview`), `disable_notification`, `protect_content`, `message_thread_id` (forum topics), `message_effect_id`, `reply_parameters`, and `reply_markup`.

### Apple Push Notification service

```ts
import { createApnsNotifier } from "@mohamedhabibwork/notifykit/apns";

const apns = await createApnsNotifier({
  token: {
    key: process.env.APNS_KEY!,
    keyId: process.env.APNS_KEY_ID!,
    teamId: process.env.APPLE_TEAM_ID!,
  },
  production: true,
});

await apns.send({
  to: { deviceToken: "apns-device-token" },
  notification: { title: "Invoice ready", body: "Your invoice is ready." },
  native: {
    topic: "com.example.app",
    pushType: "alert",
    priority: 10,
    collapseId: "invoice-1002",
    threadId: "invoices",
    sound: "default",
    badge: 1,
    category: "INVOICE_ACTIONS",
  },
});
```

Recipients may be `{ deviceToken }` or `{ deviceTokens }`.

Beyond the fields in the example, `native` supports `mutableContent`, `contentAvailable` (silent background updates), `urlArgs`, and a full custom `alert` object (`title-loc-key`, `loc-args`, `launch-image`, and so on) that overrides the title/body derived from `notification`. Core-level `ttl` becomes the APNs `expiry` (now + ttl seconds) when `native.expiration` is not set, and core-level `collapseKey` fills `collapseId`.

## Named providers with `NotificationManager`

Use a manager when an application owns multiple named provider instances. Instances initialize only when first requested.

```ts
import { createNotificationManager } from "@mohamedhabibwork/notifykit";

const notifications = createNotificationManager({
  default: "alerts",
  providers: {
    alerts: { type: "telegram", botToken: process.env.TELEGRAM_BOT_TOKEN! },
    transactionalEmail: {
      type: "email",
      transport: { type: "smtp", host: "smtp.example.com", port: 587 },
      defaults: { from: "notifications@example.com" },
    },
  },
});

const alerts = await notifications.provider("alerts");
await alerts.send({ to: { chatId: 1234 }, notification: { body: "Deploy complete." } });

const mail = await notifications.provider("transactionalEmail");
await mail.send({
  to: "user@example.com",
  notification: { title: "Deploy complete", body: "Your deployment finished." },
});

await notifications.warmup();
await notifications.close();
```

`provider('alerts')` retains Telegram recipient/native types; `provider('transactionalEmail')` retains email types.

### Multi-channel delivery

```ts
await notifications.sendMulti([
  {
    provider: "alerts",
    message: { to: { chatId: 1234 }, notification: { body: "Payment received." } },
  },
  {
    provider: "transactionalEmail",
    message: {
      to: "customer@example.com",
      notification: { title: "Payment received", body: "Your payment was confirmed." },
    },
  },
]);
```

## Batch sends, timeouts, and cancellation

`sendMany()` uses a provider-native batch operation when one is available; otherwise it uses controlled concurrency.

```ts
const controller = new AbortController();

const batch = await fcm.sendMany(
  [
    { to: { token: "token-a" }, notification: { title: "Hello" } },
    { to: { token: "token-b" }, notification: { title: "Hello" } },
  ],
  {
    concurrency: 10,
    timeout: 10_000,
    signal: controller.signal,
    metadata: { tenantId: "tenant-1", event: "campaign.created" },
  },
);

console.log(batch.successCount, batch.failureCount);
```

`metadata` is exposed to middleware and hooks only; it is never included in the provider payload.

## Middleware and hooks

Middleware wraps a send operation and is useful for telemetry, policy enforcement, idempotency, and redaction.

```ts
telegram.use(async (context, next) => {
  const startedAt = performance.now();
  try {
    const result = await next();
    console.info({
      provider: context.provider,
      elapsedMs: performance.now() - startedAt,
      ok: result.ok,
    });
    return result;
  } catch (error) {
    console.error({ provider: context.provider, error });
    throw error;
  }
});
```

Create a `Notifier` with hooks when you need lifecycle callbacks around a provider. Middleware is generally the more flexible option.

## Delivery policies: retries, rate limits, dedupe, dry-run, fallbacks

Built-in, provider-agnostic middleware and helpers cover the common production concerns:

```ts
import {
  dedupeMiddleware,
  dryRunMiddleware,
  rateLimitMiddleware,
  retryMiddleware,
} from "@mohamedhabibwork/notifykit";

telegram
  .use(dryRunMiddleware({ enabled: process.env.NOTIFY_DRY_RUN === "1" }))
  .use(dedupeMiddleware({ ttl: 60_000 })) // keyed on message.idempotencyKey
  .use(rateLimitMiddleware({ limit: 30, interval: 1_000 }))
  .use(retryMiddleware({ retries: 3, minDelay: 250 }));

const outcome = await notifications.sendFallback([
  { provider: "alerts", message: { to: { chatId: 1234 }, notification: { body: "Code: 9921" } } },
  {
    provider: "transactionalEmail",
    message: { to: "user@example.com", notification: { body: "Code: 9921" } },
  },
]);
```

See [docs/use-cases.md](docs/use-cases.md) for every supported use case with an example.

## Errors and retry classification

NotifyKit preserves the original provider error under `cause` or `native` and exposes normalized error classes:

- `NotificationConfigError`
- `NotificationAuthenticationError`
- `NotificationRecipientError`
- `NotificationRateLimitError`
- `NotificationPayloadError`
- `NotificationProviderError`
- `NotificationNetworkError`
- `NotificationTimeoutError`
- `NotificationUnsupportedError`

```ts
import { isRetryableNotificationError } from "@mohamedhabibwork/notifykit";

try {
  await telegram.send({ to: { chatId: 1234 }, notification: { body: "Hello" } });
} catch (error) {
  if (isRetryableNotificationError(error)) {
    await queue.add("notification.retry", { provider: "alerts" });
  }
  throw error;
}
```

NotifyKit does not persist retries or implement a queue. This keeps infrastructure choices—BullMQ, SQS, Kafka, RabbitMQ, or another system—in your application.

## Custom providers

Custom providers are first-class and rely only on public NotifyKit exports.

```ts
import { createNotifier } from "@mohamedhabibwork/notifykit";
import { defineNotificationProvider } from "@mohamedhabibwork/notifykit/custom";

interface DiscordConfig {
  type: "discord";
  webhookUrl: string;
}
interface DiscordRecipient {
  channel?: string;
}
interface DiscordNative {
  username?: string;
  avatar_url?: string;
}

const discordProvider = defineNotificationProvider<
  "discord",
  DiscordConfig,
  DiscordRecipient,
  DiscordNative,
  Response
>({
  name: "discord",
  capabilities: { single: true, batch: false, notification: true, data: true },
  async create(config) {
    return {
      name: "discord",
      capabilities: { single: true, batch: false, notification: true, data: true },
      async send(message) {
        const native = await fetch(config.webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: message.notification?.body, ...message.native }),
        });
        return {
          ok: native.ok,
          provider: "discord",
          status: native.ok ? "accepted" : "failed",
          native,
        };
      },
    };
  },
});

const discord = await createNotifier(
  { type: "discord", webhookUrl: process.env.DISCORD_WEBHOOK_URL! },
  { providers: [discordProvider] },
);

await discord.send({
  to: {},
  notification: { body: "Deployment complete." },
  native: { username: "Deploy Bot" },
});
```

## Templates and routing helpers

Templates are ordinary typed functions—there is no required template engine.

```ts
import { createNotificationTemplates, createNotificationRouter } from "@mohamedhabibwork/notifykit";

const templates = createNotificationTemplates({
  orderShipped: ({ orderId }: { orderId: string }) => ({
    title: "Order shipped",
    body: `Order ${orderId} is on the way.`,
  }),
});

const message = templates.render("orderShipped", { orderId: "ORD-1001" });

const router = createNotificationRouter({
  routes: {
    orderShipped: ({ email }: { email: string }) => [
      { provider: "email", message: { to: email, notification: message } },
    ],
  },
});

const channels = await router.resolve("orderShipped", { email: "customer@example.com" });
```

The router resolves your application event into channels; your application decides how to send those channels through a manager.

## Testing

Use the fake notifier to test application behavior without credentials or network calls.

```ts
import { createFakeNotifier } from "@mohamedhabibwork/notifykit/testing";

const notifier = createFakeNotifier<{ userId: string }>();

await notifier.send({ to: { userId: "100" }, notification: { title: "Hello" } });

console.log(notifier.messages());
console.log(notifier.lastMessage());

notifier.failNext(new Error("temporary provider outage"));
notifier.setLatency(20);
notifier.clear();
```

To test code that goes through `createNotifier` (factories, managers, routers), use the fake driver instead. It plugs into the custom-provider path, so your production wiring runs unchanged against a recording fake.

```ts
import { createFakeDriver } from "@mohamedhabibwork/notifykit/testing";

const driver = createFakeDriver<{ userId: string }>();

const notifier = await createNotifier({ type: "fake" }, { providers: [driver] });
const manager = createNotificationManager({
  providers: { alerts: { type: "fake" } },
  default: "alerts",
});

await notifier.send({ to: { userId: "100" }, notification: { title: "Hello" } });

console.log(driver.messages());
console.log(driver.lastMessage());

driver.failNext(new Error("temporary provider outage"));
driver.setLatency(20);
driver.clear();
```

Pass `capabilities` (in `createFakeDriver` options or per config) to simulate providers with different capability sets.

## Runtime support

| Runtime     | Support                                                  |
| ----------- | -------------------------------------------------------- |
| Node.js 20+ | First-class                                              |
| Bun 1.1+    | Core and fetch-based providers                           |
| Deno 2+     | Core and fetch-based providers through npm compatibility |

The package is server-side by design: credentials for FCM, SMTP, APNs, and bot APIs must stay outside browser bundles. SDK-backed providers follow the runtime support of their SDK; Huawei Push Kit and Telegram are fetch-based.

## Development

```sh
npm ci
npm run format
npm run lint
npm run check
npm test
npm run build

# Run all required local quality gates.
npm run verify
```

GitHub Actions validates Node 20, 22, 24, and 26; TypeScript 5.9, 6, and 7; formatting, linting, type checks, tests, build output, and Bun/Deno smoke tests.

## Changelog

`CHANGELOG.md` is generated from conventional commits (`feat:`, `fix:`, …) with [git-cliff](https://git-cliff.org) and the `cliff.toml` config. The release workflow regenerates it on every `v*` tag, uses the tag's section as the GitHub release notes, and commits the updated file back to `main`.

```sh
# Preview the changelog for unreleased commits.
npx git-cliff --unreleased

# Regenerate CHANGELOG.md.
npm run changelog
```

## Use with AI (llms.txt)

This repo ships an `llms.txt` — a curated, LLM-readable map of the API, semantics, and docs, written so coding assistants get it right the first time.

- **Cursor / Claude Code / Copilot**: open [`llms.txt`](https://github.com/mohamedhabibwork/notifykit/blob/main/llms.txt) or paste the raw text into your rules file (`CLAUDE.md`, `.cursorrules`, `AGENTS.md`).
- **ChatGPT / Custom GPTs / Perplexity**: add the raw URL — https://raw.githubusercontent.com/mohamedhabibwork/notifykit/main/llms.txt
- **Offline / agents in CI**: `llms.txt`, the README, and every guide in `docs/` ship inside the npm tarball, so agents can read them straight from `node_modules/@mohamedhabibwork/notifykit/`.
- **Contributing to this repo**: [AGENTS.md](AGENTS.md) documents layout, commands, and conventions for coding agents.

## License

[MIT](./LICENSE)

## Logging with loggerkit

Managers accept an optional `logger` (any object with `debug/info/warn/error`), so a
[`@mohamedhabibwork/loggerkit`](https://github.com/mohamedhabibwork/loggerkit) `Logger` plugs in
directly with no extra dependency:

```ts
import { createLogger } from "@mohamedhabibwork/loggerkit";
import { createNotificationManager } from "@mohamedhabibwork/notifykit";

const manager = createNotificationManager({ ...config, logger: createLogger({ name: "notify" }) });
```

Provider creation and close events are logged at `debug`; creation failures at `error`.
