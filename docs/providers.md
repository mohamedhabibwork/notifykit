# Provider entrypoints

All calls preserve each provider's native payload under `native` and preserve its response in `result.native`.

| Provider                        | Entrypoint                             | Dependency                 |
| ------------------------------- | -------------------------------------- | -------------------------- |
| Firebase Cloud Messaging        | `@mohamedhabibwork/notifykit/fcm`      | optional `firebase-admin`  |
| Huawei Push Kit                 | `@mohamedhabibwork/notifykit/huawei`   | standard `fetch`           |
| Web Push                        | `@mohamedhabibwork/notifykit/webpush`  | optional `web-push`        |
| SMTP email                      | `@mohamedhabibwork/notifykit/email`    | optional `nodemailer`      |
| Telegram Bot API                | `@mohamedhabibwork/notifykit/telegram` | standard `fetch`           |
| Apple Push Notification service | `@mohamedhabibwork/notifykit/apns`     | optional `@parse/node-apn` |

Node 20+, Bun 1.1+, and Deno 2+ can use the runtime-neutral core and fetch-based providers. SDK-backed providers follow their SDK's runtime support.

```ts
import { createHuaweiNotifier } from '@mohamedhabibwork/notifykit/huawei';
const huawei = await createHuaweiNotifier({ appId: '...', appSecret: '...' });
await huawei.send({ to: { token: 'device-token' }, notification: { title: 'Hello' } });
```
