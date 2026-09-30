# Framework integration

NotifyKit is framework-agnostic — a notifier is just an async `send()` call, so it works in any
HTTP framework, queue worker, or CLI. The recipes below cover the common integrations.

| Framework            | Pattern used below                |
| -------------------- | --------------------------------- |
| Express 4/5          | notification route                |
| Fastify 4/5          | plugin with a decorated notifier  |
| NestJS 10+           | injectable `NotificationsService` |
| Hono 4               | route handler                     |
| Next.js (App Router) | server-side route handler         |
| Elysia (Bun)         | shared async instance             |
| Elysia (Bun)         | shared async instance             |

The package itself installs with **zero dependencies**. Provider SDKs (`firebase-admin`,
`nodemailer`, `web-push`, `@parse/node-apn`) are optional peers loaded only when you create that
provider — Telegram, Slack, and Huawei use plain `fetch` and need nothing extra.

## Express

```ts
import express from "express";
import { createNotifier } from "@mohamedhabibwork/notifykit";

const app = express();
const notifier = await createNotifier({
  type: "telegram",
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
});

app.post("/alerts", express.json(), async (req, res) => {
  const result = await notifier.send({
    to: { chatId: req.body.chatId },
    notification: { title: req.body.title, body: req.body.body },
  });
  res.status(result.ok ? 202 : 502).json({ messageId: result.messageId });
});
```

## Fastify

```ts
import Fastify from "fastify";
import { createNotificationManager } from "@mohamedhabibwork/notifykit";

const app = Fastify();

app.decorate(
  "notifications",
  createNotificationManager({
    providers: {
      alerts: { type: "telegram", botToken: process.env.TELEGRAM_BOT_TOKEN! },
      mail: { type: "email", transport: { type: "smtp", host: "localhost", port: 25 } },
    },
    default: "alerts",
  }),
);

app.post("/alerts", async (request, reply) => {
  // `provider()` keeps the recipient/native types of the chosen channel.
  const notifier = await app.notifications.provider("mail");
  const result = await notifier.send({
    to: request.body.to,
    notification: request.body.notification,
  });
  return reply.code(result.ok ? 202 : 502).send({ messageId: result.messageId });
});

await app.ready();
```

## NestJS

```ts
import { Global, Injectable, Module, OnModuleInit } from "@nestjs/common";
import { createNotificationManager } from "@mohamedhabibwork/notifykit";

@Injectable()
export class NotificationsService implements OnModuleInit {
  private manager!: Awaited<ReturnType<typeof createNotificationManager>>;

  async onModuleInit() {
    this.manager = await createNotificationManager({
      providers: { alerts: { type: "telegram", botToken: process.env.TELEGRAM_BOT_TOKEN! } },
      default: "alerts",
    });
  }

  send(request: { to: { chatId: number }; notification: { title?: string; body: string } }) {
    return this.manager.provider("alerts").then((notifier) => notifier.send(request));
  }
}

@Global()
@Module({ providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
```

## Hono

```ts
import { Hono } from "hono";
import { createNotifier } from "@mohamedhabibwork/notifykit";

const notifier = await createNotifier({
  type: "telegram",
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
});
const app = new Hono();

app.post("/alerts", async (c) => {
  const body = await c.req.json();
  const result = await notifier.send({
    to: { chatId: body.chatId },
    notification: body.notification,
  });
  return c.json({ messageId: result.messageId }, result.ok ? 202 : 502);
});

export default app;
```

## Next.js (App Router)

```ts
// app/api/alerts/route.ts — server-side only; never ship tokens to the client.
import { createNotifier } from "@mohamedhabibwork/notifykit";

const notifier = await createNotifier({
  type: "telegram",
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
});

export async function POST(request: Request) {
  const body = await request.json();
  const result = await notifier.send({
    to: { chatId: body.chatId },
    notification: body.notification,
  });
  return Response.json({ messageId: result.messageId }, { status: result.ok ? 202 : 502 });
}
```

## Elysia (Bun)

```ts
import { Elysia } from "elysia";
import { createNotifier } from "@mohamedhabibwork/notifykit";

const notifier = await createNotifier({
  type: "telegram",
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
});

new Elysia()
  .post("/alerts", async ({ body, set }) => {
    const result = await notifier.send({
      to: { chatId: body.chatId },
      notification: body.notification,
    });
    set.status = result.ok ? 202 : 502;
    return { messageId: result.messageId };
  })
  .listen(3000);
```

## See also

- [Providers](providers.md) — every provider, its config, and native passthrough options.
- [Custom providers](custom-providers.md) — register your own driver.
- [Architecture](architecture.md) — how optional peers load only when created.
