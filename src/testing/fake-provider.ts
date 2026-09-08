import { Notifier } from '../core/notifier.js';
import type { NotificationCapabilities, NotificationMessage, NotificationResult, SendOptions } from '../core/types.js';
import type { NotificationProvider } from '../core/provider.js';
export interface FakeNotifier<TRecipient = { id: string }, TNative = Record<string, unknown>> extends Notifier<
  'fake',
  TRecipient,
  never,
  TNative,
  { index: number }
> {
  messages(): readonly NotificationMessage<TRecipient, TNative>[];
  lastMessage(): NotificationMessage<TRecipient, TNative> | undefined;
  clear(): void;
  failNext(error: unknown): void;
  setLatency(milliseconds: number): void;
}
export function createFakeNotifier<TRecipient = { id: string }, TNative = Record<string, unknown>>(options?: {
  capabilities?: Partial<NotificationCapabilities>;
}): FakeNotifier<TRecipient, TNative> {
  const messages: NotificationMessage<TRecipient, TNative>[] = [];
  let nextError: unknown;
  let latency = 0;
  const provider: NotificationProvider<'fake', TRecipient, never, TNative, { index: number }> = {
    name: 'fake',
    capabilities: { single: true, batch: true, notification: true, data: true, ...options?.capabilities },
    async send(
      message: NotificationMessage<TRecipient, TNative>,
      _options?: SendOptions,
    ): Promise<NotificationResult<'fake', { index: number }>> {
      if (latency) await new Promise<void>((resolve) => setTimeout(resolve, latency));
      if (nextError) {
        const error = nextError;
        nextError = undefined;
        throw error;
      }
      messages.push(message);
      return {
        ok: true,
        provider: 'fake',
        status: 'accepted',
        messageId: String(messages.length),
        native: { index: messages.length - 1 },
      };
    },
  };
  const notifier = new Notifier(provider) as FakeNotifier<TRecipient, TNative>;
  notifier.messages = () => messages.slice();
  notifier.lastMessage = () => messages.at(-1);
  notifier.clear = () => {
    messages.length = 0;
  };
  notifier.failNext = (error) => {
    nextError = error;
  };
  notifier.setLatency = (milliseconds) => {
    latency = milliseconds;
  };
  return notifier;
}
