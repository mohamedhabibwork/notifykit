# End-to-end examples

Complete, runnable applications built with NotifyKit. Each example is a single
file — install, paste, run.

## 1. Telegram deploy-alert service

The smallest useful notifier: one provider, zero dependencies beyond the
package itself (Telegram uses plain `fetch`).

```sh
mkdir alerts && cd alerts && npm init -y
npm install @mohamedhabibwork/notifykit
TELEGRAM_BOT_TOKEN=123:abc node server.mjs
```

```ts
// server.mjs — node >= 20
import express from "express";
import { createNotifier } from "@mohamedhabibwork/notifykit";

const app = express();
app.use(express.json());

const notifier = await createNotifier({
  type: "telegram",
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
});

app.post("/alerts", async (req, res) => {
  const result = await notifier.send({
    to: { chatId: req.body.chatId },
    notification: { title: req.body.title ?? "Alert", body: req.body.body },
    native: { parse_mode: "HTML" },
  });
  res.status(result.ok ? 202 : 502).json({
    provider: result.provider,
    messageId: result.messageId,
    retryable: result.retryable,
  });
});

app.listen(3000, () => console.log("POST /alerts { chatId, title?, body }"));
```

```sh
curl -X POST localhost:3000/alerts -H 'content-type: application/json' \
  -d '{"chatId": 123456789, "body": "Deployment <b>finished</b>"}'
```

## 2. Named channels, templates, and telemetry middleware

One manager for every channel; templates keep message shapes in one place;
middleware adds timing telemetry to every send.

```ts
// notifications.mjs
import {
  createNotificationManager,
  createNotificationTemplates,
} from "@mohamedhabibwork/notifykit";

export const notifications = createNotificationManager({
  providers: {
    alerts: { type: "telegram", botToken: process.env.TELEGRAM_BOT_TOKEN! },
    mail: {
      type: "email",
      transport: { type: "smtp", host: "localhost", port: 25 },
    },
  },
  default: "alerts", // created lazily on first use; closed by notifications.close()
});

export const templates = createNotificationTemplates({
  welcome: (v) => ({ title: "Welcome", body: `Hi ${v.name}, your account is ready.` }),
  outage: (v) => ({ title: `[${v.severity}] ${v.service} down`, body: v.dashboardUrl }),
});

// Telemetry around every send on every channel.
export function watch(notifier) {
  notifier.use(async (context, next) => {
    const startedAt = performance.now();
    try {
      const result = await next();
      console.info({
        provider: context.provider,
        ok: result.ok,
        ms: performance.now() - startedAt,
      });
      return result;
    } catch (error) {
      console.error({ provider: context.provider, error });
      throw error;
    }
  });
  return notifier;
}

// await (await notifications.provider("mail")).send({
//   to: { email: "ada@example.com" },
//   notification: templates.render("welcome", { name: "Ada" }),
// });
```

## 3. Requeue-safe sending from a job queue

`result.retryable` classifies failures so background workers only requeue what
is worth retrying (rate limits and network blips — not payload errors).

```ts
// worker.mjs — any queue works; this example uses @mohamedhabibwork/queuekit's memory queue.
import { createNotifier } from "@mohamedhabibwork/notifykit";
import { createQueue } from "@mohamedhabibwork/queuekit";

const notifier = await createNotifier({
  type: "telegram",
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
});
const queue = await createQueue({ type: "memory" });

await queue.publish(
  "notifications",
  { type: "welcome", payload: { chatId: 123456789, name: "Ada" } },
  { retry: { attempts: 3, backoff: { type: "exponential", delay: 1_000, maxDelay: 30_000 } } },
);

await queue.consume("notifications", async ({ message }) => {
  const result = await notifier.send({
    to: { chatId: message.payload.chatId },
    notification: { title: "Welcome", body: `Hi ${message.payload.name}` },
  });
  if (!result.ok && !result.retryable) {
    console.error("permanent failure — do not requeue", result);
  }
});
```

## 4. FCM chat push with iOS tray collapsing

Chat notifications must replace each other per conversation on iPhone. FCM's
`collapseKey` only applies to Android, so the APNs equivalents
(`apns-collapse-id` header, `thread-id` payload) are set via the
`native.apns.collapseId` / `native.apns.threadId` shorthands.

```sh
mkdir chat-push && cd chat-push && npm init -y
npm install @mohamedhabibwork/notifykit firebase-admin express
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node server.mjs
```

```ts
// server.mjs — node >= 20
import express from "express";
import { createFcmNotifier } from "@mohamedhabibwork/notifykit/fcm";

const app = express();
app.use(express.json());

const fcm = await createFcmNotifier({
  credential: {
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
  },
});

app.post("/messages", async (req, res) => {
  const { deviceToken, conversationId, sender, body } = req.body;
  const result = await fcm.send({
    to: { token: deviceToken },
    notification: { title: sender, body },
    data: { conversationId },
    native: {
      android: { priority: "high", collapseKey: conversationId },
      // collapseId: new messages replace the previous one in the tray.
      // threadId: all messages of a conversation group into one stack.
      apns: { collapseId: conversationId, threadId: conversationId },
    },
  });
  res.status(result.ok ? 202 : 502).json({ messageId: result.messageId });
});

app.listen(3000);
```

## 5. Direct APNs with rich iOS presentation

When your audience is iPhone-only, skip FCM and talk to APNs directly. The driver maps
`native` fields onto the APNs notification: `threadId` groups the conversation,
`collapseId` replaces stale messages, `ttl` becomes the APNs `expiry`, and
`sound`/`badge`/`category` drive presentation and action buttons.

```sh
mkdir apns-push && cd apns-push && npm init -y
npm install @mohamedhabibwork/notifykit @parse/node-apn express
APNS_KEY=./AuthKey_ABCD1234.p8 APNS_KEY_ID=ABCD1234 APPLE_TEAM_ID=EF98765432 node server.mjs
```

```ts
// server.mjs — node >= 20
import { readFileSync } from "node:fs";
import express from "express";
import { createApnsNotifier } from "@mohamedhabibwork/notifykit/apns";

const app = express();
app.use(express.json());

const apns = await createApnsNotifier({
  token: {
    key: readFileSync(process.env.APNS_KEY!, "utf8"),
    keyId: process.env.APNS_KEY_ID!,
    teamId: process.env.APPLE_TEAM_ID!,
  },
  production: process.env.NODE_ENV === "production",
});

app.post("/messages", async (req, res) => {
  const { deviceToken, conversationId, sender, body } = req.body;
  const result = await apns.send({
    to: { deviceToken },
    notification: { title: sender, body },
    ttl: 3600,
    collapseKey: conversationId,
    native: {
      topic: "com.example.app",
      threadId: conversationId,
      sound: "default",
      badge: 1,
      category: "MESSAGE_ACTIONS",
      mutableContent: true,
    },
  });
  res.status(result.ok ? 202 : 502).json({ status: result.status });
});

app.listen(3000);
```

## 6. WhatsApp Cloud API send with verified delivery webhooks

```ts
import express from "express";
import {
  createWhatsAppNotifier,
  parseWhatsAppWebhookEvent,
  verifyWhatsAppSignature,
} from "@mohamedhabibwork/notifykit/whatsapp";

const app = express();
const whatsapp = await createWhatsAppNotifier({
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  appSecret: process.env.WHATSAPP_APP_SECRET,
});

app.post("/order-shipped", async (req, res) => {
  const result = await whatsapp.send({
    to: { phoneNumber: req.body.phone }, // E.164 digits, no +
    native: {
      type: "template",
      template: {
        name: "order_shipped",
        language: { code: "en_US" },
        components: [{ type: "body", parameters: [{ type: "text", text: req.body.orderId }] }],
      },
    },
  });
  res.status(result.ok ? 202 : 502).json({ messageId: result.messageId });
});

// Meta webhook receiver — Express raw body is required for the signature check.
app.post("/webhooks/whatsapp", express.raw({ type: "*/*" }), async (req, res) => {
  const rawBody = req.body.toString("utf8");
  const verified = await verifyWhatsAppSignature({
    appSecret: process.env.WHATSAPP_APP_SECRET!,
    rawBody,
    signatureHeader: req.header("x-hub-signature-256"),
  });
  if (!verified) return res.sendStatus(401);
  for (const status of parseWhatsAppWebhookEvent(JSON.parse(rawBody)))
    await deliveries.record(status.messageId, status.status, status.errors?.[0]?.message);
  res.sendStatus(200);
});

app.listen(3000);
```

## 7. SMS with fallback channels (Twilio, then Vonage)

```ts
import { createNotificationManager } from "@mohamedhabibwork/notifykit";

const notifications = createNotificationManager({
  providers: {
    twilio: {
      type: "twilio",
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      authToken: process.env.TWILIO_AUTH_TOKEN!,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!,
      statusCallbackUrl: "https://example.test/webhooks/twilio",
    },
    vonage: {
      type: "vonage",
      apiKey: process.env.VONAGE_API_KEY!,
      apiSecret: process.env.VONAGE_API_SECRET!,
      defaultFrom: "Acme",
    },
  },
});

// sendFallback walks the channels in order and returns the first success.
const outcome = await notifications.sendFallback([
  {
    provider: "twilio",
    message: { to: { phoneNumber: "+15551234567" }, notification: { body: "Your code is 1234" } },
  },
  {
    provider: "vonage",
    message: { to: { phoneNumber: "15551234567" }, notification: { body: "Your code is 1234" } },
  },
]);
if (!outcome.result?.ok) retryLater(outcome.errors); // every failure is retryable → requeue
```

## Where to next

- [Providers](providers.md) — every provider, config, and native passthrough options.
- [Framework integration](frameworks.md) — Express, Fastify, NestJS, Hono, Next.js, Elysia recipes.
- [Custom providers](custom-providers.md) — register your own driver.
- [Architecture](architecture.md) — layers and optional-peer loading.
