# Huawei Push Kit

Huawei device push through Push Kit's REST API with OAuth app credentials. Fetch-based — no SDK, no extra dependency. Entrypoint: `@mohamedhabibwork/notifykit/huawei`.

## Configuration

| Option               | Required | Description                                                           |
| -------------------- | -------- | --------------------------------------------------------------------- |
| `appId`              | yes      | Push Kit app ID.                                                      |
| `appSecret`          | yes      | Push Kit app secret; exchanged for OAuth access tokens.               |
| `endpoint`           | no       | Push API base URL (regional endpoints, tests).                        |
| `authEndpoint`       | no       | OAuth base URL (regional endpoints, tests).                           |
| `auth.tokenCache`    | no       | Application-owned OAuth token cache shared across notifier instances. |
| `auth.refreshSkewMs` | no       | Refresh tokens this long before expiry; defaults to 30 seconds.       |

Recipients: `{ token }`, `{ tokens }`, `{ topic }`, or `{ condition }` — same shapes as FCM.

## Sending

```ts
import { createHuaweiNotifier } from "@mohamedhabibwork/notifykit/huawei";

const huawei = await createHuaweiNotifier({
  appId: process.env.HUAWEI_APP_ID!,
  appSecret: process.env.HUAWEI_APP_SECRET!,
});

const result = await huawei.send({
  to: { token: deviceToken },
  notification: { title: "New message", body: "Ada sent you a message" },
  data: { threadId: "812" },
  priority: "high", // applied to the Android config
  ttl: 3600_000, // applied to the Android config
});
console.log(result.messageId); // requestId-style id from Push Kit
```

Per-platform payload blocks pass through `native`:

```ts
await huawei.send({
  to: { tokens: [tokenA, tokenB] },
  notification: { title: "Sale", body: "24 hours only" },
  native: {
    android: { urgency: "HIGH", category: "PROMOTION" },
    apns: { payload: { aps: { mutableContent: true } } },
    webpush: { headers: { TTL: "3600" } },
  },
});
```

## Errors, retries, and rate limits

| Push Kit outcome                 | Thrown error                                            | Retryable  |
| -------------------------------- | ------------------------------------------------------- | ---------- |
| OAuth failure                    | `NotificationAuthenticationError`                       | no         |
| Push API 401/403 (authorization) | `NotificationAuthenticationError`                       | no         |
| Rate limited                     | `NotificationRateLimitError`                            | yes        |
| Other API rejection              | `NotificationProviderError`                             | per status |
| Transport failure / timeout      | `NotificationNetworkError` / `NotificationTimeoutError` | yes        |

```ts
import { retryMiddleware } from "@mohamedhabibwork/notifykit";
huawei.use(retryMiddleware({ maxAttempts: 3 }));
```

## Full example

Minimal send (top of this page) is the complete flow; pair with the manager for multi-brand push — see [providers.md](providers.md) and [use-cases.md](use-cases.md).
