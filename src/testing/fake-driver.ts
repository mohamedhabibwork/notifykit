import type { NotificationDriverDefinition } from '../core/provider.js';
import type { NotificationCapabilities, NotificationMessage } from '../core/types.js';
import { createFakeProvider, createFakeState, type FakeState } from './fake-provider.js';

export interface FakeDriverConfig {
  type: 'fake';
  /** Capability overrides merged over the fake defaults for providers created from this config. */
  capabilities?: Partial<NotificationCapabilities>;
}
/**
 * A driver definition for the recording fake provider, usable through `createNotifier` so tests
 * exercise the same factory path as real drivers.
 */
export interface FakeDriver<
  TRecipient = { id: string },
  TNative = Record<string, unknown>,
> extends NotificationDriverDefinition<'fake', FakeDriverConfig, TRecipient, TNative, { index: number }> {
  messages(): readonly NotificationMessage<TRecipient, TNative>[];
  lastMessage(): NotificationMessage<TRecipient, TNative> | undefined;
  clear(): void;
  failNext(error: unknown): void;
  setLatency(milliseconds: number): void;
}
export function createFakeDriver<TRecipient = { id: string }, TNative = Record<string, unknown>>(options?: {
  capabilities?: Partial<NotificationCapabilities>;
}): FakeDriver<TRecipient, TNative> {
  const state: FakeState<TRecipient, TNative> = createFakeState();
  const capabilities = (overrides?: Partial<NotificationCapabilities>): NotificationCapabilities => ({
    single: true,
    batch: true,
    notification: true,
    data: true,
    ...options?.capabilities,
    ...overrides,
  });
  return {
    name: 'fake',
    capabilities: capabilities(),
    async create(config) {
      return createFakeProvider<TRecipient, TNative>(state, capabilities(config?.capabilities));
    },
    messages: () => state.messages.slice(),
    lastMessage: () => state.messages.at(-1),
    clear: () => {
      state.messages.length = 0;
    },
    failNext: (error) => {
      state.nextError = error;
    },
    setLatency: (milliseconds) => {
      state.latency = milliseconds;
    },
  };
}
