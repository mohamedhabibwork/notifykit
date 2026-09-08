# Custom providers

Custom providers implement only public NotifyKit types. Define a `NotificationDriverDefinition`, then pass it to `createNotifier` through the provider registry. A driver should return a normalized result, preserve the upstream response in `native`, and throw a typed NotifyKit error for failures.

```ts
import { createNotifier } from '@mohamedhabibwork/notifykit';
import { defineNotificationProvider } from '@mohamedhabibwork/notifykit/custom';

const webhook = defineNotificationProvider<
  'webhook',
  { type: 'webhook'; url: string },
  { id: string },
  { headers?: Record<string, string> },
  Response
>({
  name: 'webhook',
  capabilities: { single: true, batch: false, data: true },
  async create(config) {
    return {
      name: 'webhook',
      capabilities: { single: true, batch: false, data: true },
      async send(message) {
        const native = await fetch(config.url, {
          method: 'POST',
          headers: message.native?.headers,
          body: JSON.stringify(message),
        });
        return { ok: native.ok, provider: 'webhook', status: native.ok ? 'accepted' : 'failed', native };
      },
    };
  },
});
await createNotifier({ type: 'webhook', url: 'https://example.test' }, { providers: [webhook] });
```
