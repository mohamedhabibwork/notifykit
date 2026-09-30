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

## Where to next

- [Providers](providers.md) — every provider, config, and native passthrough options.
- [Framework integration](frameworks.md) — Express, Fastify, NestJS, Hono, Next.js, Elysia recipes.
- [Custom providers](custom-providers.md) — register your own driver.
- [Architecture](architecture.md) — layers and optional-peer loading.
