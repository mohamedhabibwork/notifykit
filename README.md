# @mohamedhabibwork/notifykit

Unified TypeScript notifications across push, web push, email, messaging, and custom providers—without flattening provider-native options.

## Install

```sh
npm install @mohamedhabibwork/notifykit
# bun add @mohamedhabibwork/notifykit
# deno add npm:@mohamedhabibwork/notifykit
```

Install only the peer dependency required by the provider you use: `firebase-admin`, `web-push`, `nodemailer`, or `@parse/node-apn`. Huawei Push Kit and Telegram use the standard `fetch` API and need no SDK.

## Telegram

```ts
import { createTelegramNotifier } from '@mohamedhabibwork/notifykit/telegram';

const notifier = await createTelegramNotifier({ botToken: process.env.TELEGRAM_BOT_TOKEN! });
await notifier.send({ to: { chatId: 1234 }, notification: { body: '<b>Deployment complete</b>' }, native: { parse_mode: 'HTML' } });
```

## Manager

```ts
import { createNotificationManager } from '@mohamedhabibwork/notifykit';
const notifications = createNotificationManager({ providers: { alerts: { type: 'telegram', botToken: '...' } }, default: 'alerts' });
await (await notifications.default()).send({ to: { chatId: 1 }, notification: { body: 'Hello' } });
```

Providers initialize lazily. `native()` exposes the underlying provider client and `close()` releases provider resources.

## Custom providers

Use `defineNotificationProvider` from `@mohamedhabibwork/notifykit/custom`; it is built solely on public types.
