# Firebase Cloud Messaging (FCM)

Android, iOS (via APNs), and web push through FCM's admin SDK. SDK-backed — the optional peer `firebase-admin` loads only when the notifier is created. Entrypoint: `@mohamedhabibwork/notifykit/fcm`.

## Installation

```sh
npm install @mohamedhabibwork/notifykit firebase-admin
```

A missing SDK throws `NotificationConfigError` containing the install command instead of a module-not-found crash.

## Configuration

| Option               | Required | Description                                                                       |
| -------------------- | -------- | --------------------------------------------------------------------------------- |
| `credential`         | yes      | Either `{ projectId, clientEmail, privateKey }` or a full service-account object. |
| `appName`            | no       | Firebase app name when several FCM notifiers share one process.                   |
| `auth.tokenCache`    | no       | Application-owned OAuth token cache shared across notifier instances.             |
| `auth.refreshSkewMs` | no       | Refresh tokens this long before expiry; defaults to 30 seconds.                   |

Recipients: `{ token }`, `{ tokens }` (native batch), `{ topic }`, or `{ condition }`.

## Sending

```ts
import { createFcmNotifier } from "@mohamedhabibwork/notifykit/fcm";

const fcm = await createFcmNotifier({ credential: serviceAccount });

// Single device
const result = await fcm.send({
  to: { token: deviceToken },
  notification: { title: "New message", body: "Ada sent you a message", imageUrl: "https://…" },
  data: { threadId: "812" },
  collapseKey: "chat-812", // Android collapsing
  priority: "high", // maps to android.priority
  ttl: 3600_000, // maps to android.ttl (ms)
});

// Native batch for many tokens (one HTTP call when possible)
await fcm.sendMany(
  tokens.map((token) => ({ to: { token }, notification: { title: "Flash sale" } })),
  { concurrency: 10 },
);
```

### iOS specifics via `native.apns`

Core `collapseKey` does not apply to iOS. Use the shorthands for tray collapsing and grouping:

```ts
await fcm.send({
  to: { token: iosToken },
  notification: { title: "Chat", body: "New messages in #general" },
  native: {
    apns: {
      collapseId: "chat-812", // apns-collapse-id header
      threadId: "general", // aps["thread-id"] — stacks in Notification Center
      fcmOptions: { imageUrl: "https://…" },
      payload: { aps: { mutableContent: true } }, // Notification Service Extension
    },
  },
});
```

`native.android`, `native.webpush`, and `native.fcmOptions` pass through to the HTTP v1 payload unchanged.

## Errors, retries, and rate limits

Failures throw `NotificationProviderError` (FCM's admin SDK surfaces most outcomes this way); configuration and missing-SDK problems throw `NotificationConfigError`. Transport-level failures inside the SDK propagate as thrown errors; the `retryMiddleware` policy retries anything marked `retryable`. `sendMany` returns per-message results — `failureCount` plus a `results` array — instead of throwing on partial failure, so failed tokens can be pruned.

```ts
import { retryMiddleware } from "@mohamedhabibwork/notifykit";
fcm.use(retryMiddleware({ maxAttempts: 3 }));
```

## Full example

FCM chat push with iOS tray collapsing — see [examples.md, section 4](examples.md#4-fcm-chat-push-with-ios-tray-collapsing).
