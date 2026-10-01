# SMTP Email

Classic SMTP email through nodemailer. SDK-backed — the optional peer `nodemailer` loads only when the notifier is created. Entrypoint: `@mohamedhabibwork/notifykit/email`.

For an HTTP email API without a socket, see [`resend`](resend.md).

## Installation

```sh
npm install @mohamedhabibwork/notifykit nodemailer
```

## Configuration

| Option          | Required | Description                                                             |
| --------------- | -------- | ----------------------------------------------------------------------- |
| `transport`     | yes      | A nodemailer transport: `{ type: "smtp", host, port, secure?, auth? }`. |
| `defaults.from` | no       | Default From address; per-message `native.from` wins.                   |

Recipients are strings, `{ email, name }` objects, or arrays of both.

## Sending

```ts
import { createEmailNotifier } from "@mohamedhabibwork/notifykit/email";

const email = await createEmailNotifier({
  transport: {
    type: "smtp",
    host: process.env.SMTP_HOST!,
    port: 587,
    secure: false,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  },
  defaults: { from: { email: "alerts@example.test", name: "Acme" } },
});

const result = await email.send({
  to: [{ email: "user@example.test", name: "Ada" }],
  notification: { title: "Weekly digest", body: "Everything shipped." },
  priority: "high", // maps to SMTP precedence headers
});
console.log(result.messageId); // SMTP Message-ID
```

HTML, threading, attachments, and custom headers pass through `native`:

```ts
await email.send({
  to: "user@example.test",
  notification: { title: "Re: Ticket 4412" },
  native: {
    html: "<h1>Ticket update</h1><p>Your ticket moved to <b>In Progress</b>.</p>",
    replyTo: "support@example.test",
    cc: "qa@example.test",
    bcc: "audit@example.test",
    inReplyTo: "<ticket-4412@example.test>",
    references: ["<ticket-4412@example.test>"],
    headers: { "X-Campaign": "support-41" },
    attachments: [
      { filename: "report.pdf", content: pdfBytes, contentType: "application/pdf", cid: "report" },
    ],
  },
});
```

Inline images: set `cid` on an attachment and reference it in the HTML (`<img src="cid:report">`).

## Errors, retries, and rate limits

| Outcome                               | Thrown error                | Retryable |
| ------------------------------------- | --------------------------- | --------- |
| Missing `nodemailer` package          | `NotificationConfigError`   | no        |
| No body/text/html provided            | `NotificationProviderError` | no        |
| SMTP rejection (4xx greylisting, 5xx) | `NotificationProviderError` | yes       |
| Transport failure                     | propagates from nodemailer  | —         |

```ts
import { retryMiddleware } from "@mohamedhabibwork/notifykit";
email.use(retryMiddleware({ maxAttempts: 3 })); // SMTP greylisting is retryable
```

## Full example

Named channels with templates and telemetry middleware over email + Telegram — see [examples.md, section 2](examples.md#2-named-channels-templates-and-telemetry-middleware).
