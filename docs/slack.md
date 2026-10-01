# Slack

Slack messages via `chat.postMessage` (bot token) or incoming webhooks. Fetch-based — no SDK, no extra dependency. Entrypoint: `@mohamedhabibwork/notifykit/slack`.

## Configuration

| Option       | Required | Description                                                        |
| ------------ | -------- | ------------------------------------------------------------------ |
| `botToken`   | one of   | Bot token (`xoxb-…`) used with `chat.postMessage`.                 |
| `webhookUrl` | one of   | Default incoming-webhook URL. At least one of the two is required. |
| `apiUrl`     | no       | Slack API base URL; defaults to `https://slack.com/api`.           |

Recipients: `{ channel }` for the bot token (channel id like `C1234ABC` or `@username`), or `{ webhookUrl }` to send through a specific incoming webhook (falls back to the configured default).

## Sending

```ts
import { createSlackNotifier } from "@mohamedhabibwork/notifykit/slack";

const slack = await createSlackNotifier({
  botToken: process.env.SLACK_BOT_TOKEN!,
});

const result = await slack.send({
  to: { channel: "C1234ABC" },
  notification: { title: "Deploy finished", body: "Build #812 is live on prod" },
});
console.log(result.messageId); // Slack message ts — use it to thread replies
```

Block Kit layouts, threads, unfurling, and identity pass through `native`:

```ts
await slack.send({
  to: { channel: "C1234ABC" },
  notification: { body: "New incident opened" },
  native: {
    thread_ts: result.messageId, // reply in-thread
    reply_broadcast: true,
    unfurl_links: false,
    metadata: { event_type: "incident_opened", event_payload: { id: "INC-41" } },
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: "*INC-41* — API 5xx spike in `eu-west-1`" },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            style: "primary",
            text: { type: "plain_text", text: "Ack" },
            action_id: "ack",
          },
          {
            type: "button",
            style: "danger",
            text: { type: "plain_text", text: "Resolve" },
            action_id: "resolve",
          },
        ],
      },
    ],
  },
});
```

Incoming-webhook style (no bot token needed):

```ts
const hook = await createSlackNotifier({ webhookUrl: process.env.SLACK_WEBHOOK_URL! });
await hook.send({
  to: { webhookUrl: process.env.ALERTS_HOOK_URL },
  notification: { body: "Disk 91% on db-1" },
});
```

## Errors, retries, and rate limits

| Slack outcome                                        | Thrown error                                            | Retryable  |
| ---------------------------------------------------- | ------------------------------------------------------- | ---------- |
| HTTP 401/403 (invalid token)                         | `NotificationAuthenticationError`                       | no         |
| HTTP 429                                             | `NotificationRateLimitError`                            | yes        |
| `chat.postMessage` `ok: false` (channel not found,…) | `NotificationProviderError`                             | per status |
| Transport failure / timeout                          | `NotificationNetworkError` / `NotificationTimeoutError` | yes        |

Slack's Tier-3 apps allow ~1 message/second — pace with the policy:

```ts
import { retryMiddleware, rateLimitMiddleware } from "@mohamedhabibwork/notifykit";
slack.use(rateLimitMiddleware({ maxPerSecond: 1 }));
slack.use(retryMiddleware({ maxAttempts: 3 }));
```

## Full example

Named channels, templates, and telemetry middleware (Slack + email) — see [examples.md, section 2](examples.md#2-named-channels-templates-and-telemetry-middleware).
