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
/** Mutable state shared between a fake provider and its inspection recorder. */
export interface FakeState<TRecipient = { id: string }, TNative = Record<string, unknown>> {
  messages: NotificationMessage<TRecipient, TNative>[];
  nextError: unknown;
  latency: number;
}
export function createFakeState<TRecipient = { id: string }, TNative = Record<string, unknown>>(): FakeState<
  TRecipient,
  TNative
> {
  return { messages: [], nextError: undefined, latency: 0 };
}
export function createFakeProvider<TRecipient = { id: string }, TNative = Record<string, unknown>>(
  state: FakeState<TRecipient, TNative>,
  capabilities: NotificationCapabilities,
): NotificationProvider<'fake', TRecipient, never, TNative, { index: number }> {
  return {
    name: 'fake',
    capabilities,
    async send(
      message: NotificationMessage<TRecipient, TNative>,
      _options?: SendOptions,
    ): Promise<NotificationResult<'fake', { index: number }>> {
      if (state.latency) await new Promise<void>((resolve) => setTimeout(resolve, state.latency));
      if (state.nextError) {
        const error = state.nextError;
        state.nextError = undefined;
        throw error;
      }
      state.messages.push(message);
      return {
        ok: true,
        provider: 'fake',
        status: 'accepted',
        messageId: String(state.messages.length),
        native: { index: state.messages.length - 1 },
      };
    },
  };
}
export function createFakeNotifier<TRecipient = { id: string }, TNative = Record<string, unknown>>(options?: {
  capabilities?: Partial<NotificationCapabilities>;
}): FakeNotifier<TRecipient, TNative> {
  const state = createFakeState<TRecipient, TNative>();
  const provider = createFakeProvider(state, {
    single: true,
    batch: true,
    notification: true,
    data: true,
    ...options?.capabilities,
  });
  const notifier = new Notifier(provider) as FakeNotifier<TRecipient, TNative>;
  notifier.messages = () => state.messages.slice();
  notifier.lastMessage = () => state.messages.at(-1);
  notifier.clear = () => {
    state.messages.length = 0;
  };
  notifier.failNext = (error) => {
    state.nextError = error;
  };
  notifier.setLatency = (milliseconds) => {
    state.latency = milliseconds;
  };
  return notifier;
}
