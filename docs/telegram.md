# Telegram Bot API

Telegram messages through the Bot API. Fetch-based — no SDK, no extra dependency. Entrypoint: `@mohamedhabibwork/notifykit/telegram`.

## Configuration

| Option     | Required | Description                                                                                  |
| ---------- | -------- | -------------------------------------------------------------------------------------------- |
| `botToken` | yes      | Bot token from @BotFather.                                                                   |
| `apiUrl`   | no       | Bot API base URL; defaults to `https://api.telegram.org` (useful for local bot API servers). |

Recipients are `{ chatId }` (number or string) or `{ channel }` (`@channelname`).

## Sending

```ts
import { createTelegramNotifier } from "@mohamedhabibwork/notifykit/telegram";

const telegram = await createTelegramNotifier({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
});

const result = await telegram.send({
  to: { chatId: 123456789 },
  notification: { title: "Deploy", body: "Build #812 passed" },
});
console.log(result.messageId); // Telegram message_id
```

Formatting, forum topics, replies, keyboards, and preview control pass through `native`:

```ts
await telegram.send({
  to: { channel: "@deployments" },
  notification: { body: "<b>prod</b> deploy finished" },
  native: {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    message_thread_id: 3, // forum topic
    reply_parameters: { message_id: 5 }, // quote a message
    reply_markup: {
      inline_keyboard: [
        [
          { text: "View build", url: "https://ci.example.test/812" },
          { text: "Roll back", callback_data: "rollback:812" },
        ],
      ],
    },
  },
});
```

For precise styling without a parse mode, pass `native.entities` (offset/length entity spans) instead.

## Errors, retries, and rate limits

| Bot API outcome                       | Thrown error                                            | Retryable  |
| ------------------------------------- | ------------------------------------------------------- | ---------- |
| HTTP 401/403 (bad token, blocked bot) | `NotificationAuthenticationError`                       | no         |
| HTTP 429                              | `NotificationRateLimitError`                            | yes        |
| Other API rejection (bad chat, etc.)  | `NotificationProviderError`                             | per status |
| Transport failure / timeout           | `NotificationNetworkError` / `NotificationTimeoutError` | yes        |

Telegram enforces ~30 messages/second globally and 1/second per chat — use the rate-limit policy:

```ts
import { retryMiddleware, rateLimitMiddleware } from "@mohamedhabibwork/notifykit";
telegram.use(rateLimitMiddleware({ maxPerSecond: 25 }));
telegram.use(retryMiddleware({ maxAttempts: 3 }));
```

## Full example

Telegram deploy-alert service end to end — see [examples.md, section 1](examples.md#1-telegram-deploy-alert-service); multi-channel fan-out with email in [section 2](examples.md#2-named-channels-templates-and-telemetry-middleware).
