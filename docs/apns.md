# Apple Push Notification service (APNs)

Direct iOS/tvOS/watchOS/macOS push through APNs with token-based auth. SDK-backed — the optional peer `@parse/node-apn` loads only when the notifier is created. Entrypoint: `@mohamedhabibwork/notifykit/apns`.

Use APNs when you control the raw Apple payload; use [`fcm`](fcm.md) when one message must fan out to Android and iOS.

## Installation

```sh
npm install @mohamedhabibwork/notifykit @parse/node-apn
```

## Configuration

| Option       | Required | Description                                                                                               |
| ------------ | -------- | --------------------------------------------------------------------------------------------------------- |
| `token`      | yes      | `{ key, keyId, teamId }` — the `.p8` key contents, key id, and team id from your Apple Developer account. |
| `production` | no       | Use `api.push.apple.com` when true; defaults to the sandbox host.                                         |

Recipients: `{ deviceToken }` or `{ deviceTokens: [...] }`.

## Sending

```ts
import { createApnsNotifier } from "@mohamedhabibwork/notifykit/apns";

const apns = await createApnsNotifier({
  token: {
    key: process.env.APNS_KEY!.replace(/\\n/g, "\n"),
    keyId: process.env.APNS_KEY_ID!,
    teamId: process.env.APNS_TEAM_ID!,
  },
  production: true,
});

const result = await apns.send({
  to: { deviceToken: hexDeviceToken },
  notification: { title: "New message", body: "Ada sent you a message" },
  collapseKey: "chat-812", // maps to apns-collapse-id
  ttl: 3600, // maps to apns-expiration
  priority: "high", // 10
});
```

The full APNs `aps` surface — sound, badge, category actions, background updates, rich alerts — lives in `native`:

```ts
await apns.send({
  to: { deviceToken: hexDeviceToken },
  notification: { title: "Order shipped", body: "Track your parcel" },
  native: {
    topic: "com.example.app", // app bundle ID — required on real devices
    pushType: "alert",
    sound: "default",
    badge: 1,
    threadId: "order-812", // stacks in Notification Center
    category: "TRACKING_ACTIONS",
    mutableContent: true, // Notification Service Extension
    payload: { orderId: "812" }, // custom keys beside `aps`
  },
});
```

Silent background push:

```ts
await apns.send({
  to: { deviceToken: hexDeviceToken },
  native: {
    topic: "com.example.app",
    pushType: "background",
    priority: 5,
    contentAvailable: true,
    payload: { sync: true },
  },
});
```

## Errors, retries, and rate limits

| Outcome                             | Thrown error                | Retryable |
| ----------------------------------- | --------------------------- | --------- |
| Missing `@parse/node-apn` package   | `NotificationConfigError`   | no        |
| Per-device rejects (410 gone, etc.) | `NotificationProviderError` | no        |
| APNs service failure                | `NotificationProviderError` | yes       |

`result.native` carries `{ sent, failed }` arrays for multi-device sends — prune tokens from the `failed` list. `sendMany` returns per-message results instead of throwing on partial failure.

## Full example

Direct APNs with rich iOS presentation — see [examples.md, section 5](examples.md#5-direct-apns-with-rich-ios-presentation).
