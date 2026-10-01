# Provider entrypoints

Every provider has a dedicated guide with configuration, message formats and templates, delivery-status callbacks, error/retry behavior, and full examples:

| Provider                        | Guide                      | Entrypoint                             | Dependency                 |
| ------------------------------- | -------------------------- | -------------------------------------- | -------------------------- |
| Firebase Cloud Messaging        | [fcm.md](fcm.md)           | `@mohamedhabibwork/notifykit/fcm`      | optional `firebase-admin`  |
| Huawei Push Kit                 | [huawei.md](huawei.md)     | `@mohamedhabibwork/notifykit/huawei`   | standard `fetch`           |
| Web Push                        | [webpush.md](webpush.md)   | `@mohamedhabibwork/notifykit/webpush`  | optional `web-push`        |
| SMTP email                      | [email.md](email.md)       | `@mohamedhabibwork/notifykit/email`    | optional `nodemailer`      |
| Telegram Bot API                | [telegram.md](telegram.md) | `@mohamedhabibwork/notifykit/telegram` | standard `fetch`           |
| Apple Push Notification service | [apns.md](apns.md)         | `@mohamedhabibwork/notifykit/apns`     | optional `@parse/node-apn` |
| Slack                           | [slack.md](slack.md)       | `@mohamedhabibwork/notifykit/slack`    | standard `fetch`           |
| WhatsApp Business Cloud API     | [whatsapp.md](whatsapp.md) | `@mohamedhabibwork/notifykit/whatsapp` | standard `fetch`           |
| Twilio Messaging (SMS/WhatsApp) | [twilio.md](twilio.md)     | `@mohamedhabibwork/notifykit/twilio`   | standard `fetch`           |
| Vonage SMS API                  | [vonage.md](vonage.md)     | `@mohamedhabibwork/notifykit/vonage`   | standard `fetch`           |
| Resend Email API                | [resend.md](resend.md)     | `@mohamedhabibwork/notifykit/resend`   | standard `fetch`           |

End-to-end apps combining several providers live in [examples.md](examples.md); use-case-driven picks are in [use-cases.md](use-cases.md).

All calls preserve each provider's native payload under `native` and preserve its response in `result.native`.

Node 20+, Bun 1.1+, and Deno 2+ can use the runtime-neutral core and fetch-based providers. SDK-backed providers follow their SDK's runtime support.

```ts
import { createHuaweiNotifier } from "@mohamedhabibwork/notifykit/huawei";
const huawei = await createHuaweiNotifier({ appId: "...", appSecret: "..." });
await huawei.send({ to: { token: "device-token" }, notification: { title: "Hello" } });
```

FCM messages going to iOS devices accept `native.apns.collapseId` (APNs `apns-collapse-id` header) and `native.apns.threadId` (`aps["thread-id"]` payload) shorthands for tray collapsing and grouping; `android.collapseKey` does not apply to iOS.

Core-level fields (`priority`, `ttl`, `collapseKey`) map to each push provider's native equivalent by default: FCM and Huawei apply them to the Android config, APNs derives `expiry`/`collapseId`, Web Push derives `TTL`, and email maps `priority` to SMTP precedence headers.
