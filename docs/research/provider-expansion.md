# Notification provider expansion research

Research date: 2026-09-15

This note evaluates server-side providers that fit NotifyKit beyond its current FCM, Huawei Push Kit, native Web Push, SMTP, Telegram, APNs, and Slack drivers. It is deliberately implementation-oriented and uses first-party documentation only.

## Recommendation

Add the four requested providers first, in this order:

1. **Expo Push** — a small fetch-based driver with Expo push tokens, ticket responses, and a separate receipt lookup helper.
2. **OneSignal** — a fetch-based multi-channel driver, initially exposing push while retaining the native request body for aliases, segments, filters, scheduling, and channel-specific options.
3. **Discord** — a fetch-based incoming-webhook driver. Treat it as channel messaging, parallel to Slack and Telegram, rather than device push.
4. **AWS SNS** — an SDK-backed driver using optional peer dependency `@aws-sdk/client-sns`; support topic ARN, platform endpoint ARN, and phone-number targets without reimplementing AWS Signature Version 4.

After those, the strongest restrained shortlist is **Pusher Beams**, **Azure Notification Hubs**, and **Twilio Messaging**. They cover managed device push on another major platform, Azure-centric cross-platform push, and direct SMS/WhatsApp-style messaging respectively. Avoid adding several thin wrappers over the same APNs/FCM transport until the four requested providers and their lifecycle behavior are tested.

## Provider matrix

| Provider                | NotifyKit role                                      | Recipient/target                                                | Authentication                                                                                       | Transport and dependency                                                | Send result to preserve                                                                                                     |
| ----------------------- | --------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Expo Push               | Managed mobile push                                 | Expo push token(s)                                              | No authentication by default; optional Expo access token when enhanced push security is enabled      | HTTPS `fetch`; optional use of `expo-server-sdk` should not be required | Push ticket(s), including ticket IDs for receipt lookup                                                                     |
| OneSignal               | Managed push first; API also supports email and SMS | Exactly one targeting method: aliases, segments, or filters     | OneSignal App ID plus REST API key in `Authorization: Key …`                                         | HTTPS `fetch`                                                           | Message ID and complete response; a valid request can return HTTP 200 without an ID when no valid subscription was targeted |
| AWS SNS                 | AWS broker for mobile push, topics, and SMS         | Platform `EndpointArn`, `TopicArn`, or phone number             | Standard AWS credential provider chain and region                                                    | Optional peer dependency `@aws-sdk/client-sns`                          | `MessageId`, `SequenceNumber` where applicable, and SDK metadata                                                            |
| Discord                 | Channel messaging                                   | Incoming webhook URL, optionally a thread ID                    | Webhook ID/token embedded in the secret webhook URL; no bot is needed for incoming-webhook execution | HTTPS `fetch`                                                           | Returned message when `wait=true`; otherwise HTTP outcome                                                                   |
| Pusher Beams            | Managed APNs/FCM/Web Push                           | Up to 100 interests, or authenticated user IDs                  | Instance ID and bearer secret key                                                                    | HTTPS `fetch`                                                           | `publishId`                                                                                                                 |
| Azure Notification Hubs | Azure-managed cross-platform push                   | Tags/tag expressions, registrations/installations, or broadcast | Azure SAS credentials/connection string                                                              | Prefer optional Azure SDK; REST is available                            | Azure response/request metadata                                                                                             |
| Twilio Messaging        | SMS/MMS and messaging channels                      | E.164 phone number or channel address                           | Account SID plus API key/secret or auth token                                                        | Prefer optional `twilio` SDK, or form-encoded HTTPS API                 | Message SID and initial status                                                                                              |

## Requested providers

### Expo Push

Expo accepts `POST https://exp.host/--/api/v2/push/send`. The body is either one message or an array of at most 100 messages from the same Expo project. Each message requires `to`, which may itself be an Expo push token or an array of tokens; common normalized fields map naturally to `title`, `body`, and `data`. Expo currently permits 600 notifications per second per project and recommends exponential backoff for network errors, HTTP 429, and HTTP 5xx responses. ([Expo: sending notifications](https://docs.expo.dev/push-notifications/sending-notifications/))

The send response is only a **push ticket**, not final provider delivery. Successful tickets include an ID. NotifyKit should expose a `getReceipts(ids)` helper that posts up to 1,000 ticket IDs to `https://exp.host/--/api/v2/push/getReceipts`. Expo recommends checking receipts about 15 minutes after send, clears them after 24 hours, and requires senders to stop using a token when the receipt reports `DeviceNotRegistered`. ([Expo: sending notifications](https://docs.expo.dev/push-notifications/sending-notifications/))

Authentication is optional by default. Projects can enable enhanced push security, after which requests must send `Authorization: Bearer <access-token>`; missing or invalid credentials produce `UNAUTHORIZED`. A config shape should therefore accept an optional `accessToken`, without requiring it. Expo explicitly notes that its service has no SLA. ([Expo: sending notifications](https://docs.expo.dev/push-notifications/sending-notifications/))

Suggested surface:

```ts
type ExpoConfig = {
  type: "expo";
  accessToken?: string;
};

type ExpoRecipient = { token: string } | { tokens: readonly string[] };
```

Important driver behavior:

- Chunk sends to 100 message objects and receipt queries to 1,000 IDs.
- Do not combine tokens from different Expo projects in one request.
- Preserve tickets one-for-one with the requested messages; an HTTP 200 may contain per-ticket errors.
- Retry only transport failures, 429, and 5xx with exponential backoff. Do not retry malformed payloads or permanent ticket/receipt errors.
- Provide receipt lookup as an explicit API rather than pretending a send ticket means delivery.

### OneSignal

OneSignal creates messages with `POST https://api.onesignal.com/notifications`, using `Authorization: Key <REST_API_KEY>`, `Content-Type: application/json`, and `app_id` in the JSON body. The API can send push, email, SMS, and Live Activities, but the first NotifyKit driver should identify itself as managed push and let callers pass channel-specific features through `native`. ([OneSignal: Create Message](https://documentation.onesignal.com/reference/create-message))

One request must use exactly one audience method: aliases, segments, or filters. Alias targeting supports up to 20,000 users per request; filters support up to 200 total filter/operator entries. Platform selection can further restrict push to Android, iOS, or web. A successful HTTP 200 response with no `id` means no message was created, commonly because the audience contained no valid subscriptions; the driver must not report that case as an ordinary successful delivery. ([OneSignal: Create Message](https://documentation.onesignal.com/reference/create-message))

OneSignal supports an RFC 9562 UUID `idempotency_key` on message creation. It is retained for 30 days and returns the original result on retries, preventing duplicate processing. OneSignal advises honoring `Retry-After`, using the same idempotency key when retrying timeouts/5xx/429 responses, and not interpreting idempotency as a delivery guarantee. ([OneSignal: idempotent API requests](https://documentation.onesignal.com/reference/idempotent-notification-requests), [OneSignal: REST API overview](https://documentation.onesignal.com/reference/rest-api-overview))

Suggested surface:

```ts
type OneSignalConfig = {
  type: "onesignal";
  appId: string;
  apiKey: string;
};

type OneSignalRecipient =
  | { aliases: Record<string, readonly string[]> }
  | { includedSegments: readonly string[]; excludedSegments?: readonly string[] }
  | { filters: readonly unknown[] };
```

Important driver behavior:

- Enforce the one-targeting-method rule in TypeScript and at runtime.
- Map normalized title/body into OneSignal `headings`/`contents`, using a documented default locale such as `en`, while allowing native localized maps to override them.
- Accept or generate an idempotency UUID for safe retries and return it with the result.
- Treat HTTP 200 without a message ID as a rejected/no-recipient outcome, preserving the native response.
- Do not silently multiplex push, email, and SMS from one normalized send; explicit channel selection is safer.

### AWS SNS

Amazon SNS `Publish` can send to a topic, directly to a mobile platform endpoint via `TargetArn`, or directly to a phone number for SMS. For mobile push, the normal lifecycle is: create a platform application, turn the device token into a platform endpoint, then publish using that endpoint ARN. SNS currently fronts ADM, APNs, Baidu, FCM, MPNS, and WNS for mobile push. ([AWS: mobile push notifications](https://docs.aws.amazon.com/sns/latest/dg/mobile-push-mpns.html), [AWS: Publish API](https://docs.aws.amazon.com/sns/latest/api/API_Publish.html))

Use the modular AWS SDK v3 package `@aws-sdk/client-sns`. AWS's official JavaScript example constructs `SNSClient` and sends `PublishCommand`; this lets applications use the standard AWS region and credential provider chain and avoids implementing request signing inside NotifyKit. ([AWS SDK for JavaScript v3: SNS examples](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_sns_code_examples.html))

Suggested surface:

```ts
type AwsSnsConfig = {
  type: "aws-sns";
  region?: string;
  credentials?: unknown; // typed from the optional SDK in the actual module
};

type AwsSnsRecipient = { topicArn: string } | { endpointArn: string } | { phoneNumber: string };
```

Important driver behavior:

- Make `@aws-sdk/client-sns` an optional peer dependency and load it only from the `aws-sns` entrypoint.
- Keep platform-specific JSON, `MessageStructure`, message attributes, FIFO `MessageGroupId`, and `MessageDeduplicationId` available under `native`.
- Require exactly one destination kind. Map an endpoint ARN to `TargetArn`, a topic ARN to `TopicArn`, and a phone number to `PhoneNumber`.
- Preserve `MessageId`, optional FIFO `SequenceNumber`, and `$metadata` in the native result.
- Do not call SNS a new delivery transport for APNs/FCM; it is an AWS-managed broker over those services and requires their platform credentials during application setup.

### Discord

Discord incoming webhooks post messages to channels without a bot user or separate authentication. Execute the generated webhook URL and allow the endpoint's optional `thread_id` query parameter for forum/media channel threads. Sending with `wait=true` returns the created message; Discord's current documentation says `wait` defaults to true for webhook execution, but the driver should set it explicitly so result semantics remain stable. ([Discord: Webhook Resource](https://docs.discord.com/developers/resources/webhook))

The useful native payload includes `content` (up to 2,000 characters), up to 10 embeds, `allowed_mentions`, components, polls, attachments, and optional username/avatar overrides where supported. NotifyKit should default to a restrictive `allowed_mentions` value so arbitrary normalized text cannot unexpectedly ping `@everyone`, roles, or users; callers can deliberately override it in `native`. ([Discord: Webhook Resource](https://docs.discord.com/developers/resources/webhook))

Discord says rate-limit values can change and must not be hard-coded. Clients should consume the `X-RateLimit-*` headers and, on HTTP 429, wait for `Retry-After` or the JSON `retry_after` value. A webhook returning 404 should be disabled instead of repeatedly retried. ([Discord: rate limits](https://docs.discord.com/developers/topics/rate-limits))

Suggested surface:

```ts
type DiscordConfig = {
  type: "discord";
  webhookUrl: string;
};

type DiscordRecipient = {
  threadId?: string;
};
```

Important driver behavior:

- Treat the complete webhook URL as a secret and redact its token from errors/loggable diagnostic objects.
- Always request `wait=true` and preserve the returned Discord message.
- Respect dynamic rate-limit headers; do not embed a fixed requests-per-second value.
- Fail permanently on 401/403/404, and retry 429/5xx only according to server guidance.
- Keep file upload support out of the first version unless NotifyKit's core adopts a common attachment abstraction; JSON content and embeds are sufficient for an initial driver.

## Additional high-value providers

### Pusher Beams

Pusher Beams offers managed mobile and web push. Its publish API has distinct endpoints for interests and authenticated users, uses `Authorization: Bearer <secret-key>`, and returns a `publishId`. Interest sends accept 1–100 interests; documented request limits are 10 KiB for interests and 200 KiB for user publishing, with a published maximum of 100 requests per second and standard 400/401/402/404/422/429/500 outcomes. ([Pusher Beams: Publish API](https://pusher.com/docs/beams/reference/publish-api/))

This is a good phase-two fetch driver because the API is compact and its interests/users model maps cleanly to a recipient union. It overlaps OneSignal and direct APNs/FCM, so it should follow rather than precede the requested providers.

### Azure Notification Hubs

Azure Notification Hubs is a scaled-out push engine for iOS, Android, Windows, and other platforms from cloud or on-premises backends. Devices register platform notification handles with a hub and backends send to users or interest groups; Microsoft exposes both management/data SDKs and a REST interface for sending and registration management. ([Microsoft: Notification Hubs overview](https://learn.microsoft.com/en-us/azure/notification-hubs/notification-hubs-push-notification-overview), [Microsoft: REST interface](https://learn.microsoft.com/en-us/rest/api/notificationhubs/use-notification-hubs-rest-interface))

This is strategically valuable for Azure users, but SAS signing, hub namespaces, platform-specific headers, installations/registrations, and tag expressions make it a larger driver. Prefer an optional official Azure SDK dependency and scope version one to sending; endpoint lifecycle management can be a separate helper later.

### Twilio Messaging

Twilio creates outbound messages with `POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json`. Every message needs a recipient (`To`), sender (`From` or `MessagingServiceSid`), and content (`Body`, `MediaUrl`, or `ContentSid`). The response includes a stable message SID and a lifecycle status such as queued, sent, delivered, failed, or undelivered. Twilio warns that `error_code` values can change and should not be used as program logic. ([Twilio: Messages resource](https://www.twilio.com/docs/messaging/api/message-resource))

Twilio is the best next channel expansion because NotifyKit currently lacks SMS. It deserves its own normalized SMS/message contract rather than forcing phone numbers into the device-push recipient model. Use the official SDK as an optional peer dependency or implement the documented form-encoded endpoint with careful credential handling.

## Cross-provider implementation rules

The new drivers should follow these common rules:

- **Separate acceptance from delivery.** Expo tickets, OneSignal message IDs, SNS message IDs, and Twilio queued statuses acknowledge provider acceptance, not end-device delivery.
- **Preserve native capability.** Normalize only the common title/body/data fields, merge provider-native options afterward, and return the complete native provider response.
- **Use discriminated recipients.** OneSignal audience methods and SNS destination types are mutually exclusive; encode that rather than accepting a bag of optional fields.
- **Classify retryability.** Retry network failures, 429, and provider 5xx responses with backoff. Do not retry invalid credentials, malformed payloads, unknown recipients, or deleted webhooks. Honor `Retry-After` when supplied.
- **Make duplicate protection explicit.** Use OneSignal's idempotency key and SNS FIFO deduplication where applicable. Other providers do not offer a universal idempotency guarantee, so automatic retries must be conservative and documented.
- **Keep secrets out of errors.** Redact OneSignal keys, Expo access tokens, AWS credentials, Pusher secret keys, Twilio credentials, and especially Discord webhook URLs.
- **Keep runtime-neutral providers fetch-based.** Expo, OneSignal, Discord, and Pusher Beams need no mandatory SDK. AWS SNS should use its signing-aware SDK; Azure and Twilio may use optional official SDKs if implemented.
- **Add contract tests per provider.** Mock HTTP/SDK boundaries and verify URL, auth, normalized-to-native mapping, recipient exclusivity, native override behavior, result mapping, redaction, and permanent versus retryable errors.

## Proposed rollout

1. Add Expo and Discord first: both are small, fetch-based, and exercise mobile-push lifecycle versus channel-webhook behavior.
2. Add OneSignal with discriminated audience types and idempotent retry coverage.
3. Add AWS SNS with a lazy optional SDK dependency and target-union tests.
4. Update provider documentation and the package export map only when each driver has implementation and tests; do not advertise planned providers as supported.
5. Reassess Pusher Beams, Azure Notification Hubs, and Twilio after the first four stabilize.
