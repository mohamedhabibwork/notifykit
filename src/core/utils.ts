import { NotificationPayloadError, NotificationTimeoutError } from './errors.js';
import type { BatchNotificationResult, NotificationMessage, NotificationResult, SendOptions } from './types.js';
export function validateMessage<TRecipient, TNative>(
  message: NotificationMessage<TRecipient, TNative>,
  provider: string,
): void {
  if (message.to == null)
    throw new NotificationPayloadError('A notification recipient is required.', { provider, retryable: false });
  if (message.ttl != null && (!Number.isFinite(message.ttl) || message.ttl < 0))
    throw new NotificationPayloadError('ttl must be a non-negative finite number.', { provider, retryable: false });
  if (!message.notification && !message.data && !message.native)
    throw new NotificationPayloadError('A notification must contain notification, data, or native content.', {
      provider,
      retryable: false,
    });
}
export async function withTimeout<T>(
  run: (signal: AbortSignal | undefined) => Promise<T>,
  options: SendOptions | undefined,
  provider: string,
): Promise<T> {
  if (!options?.timeout) return run(options?.signal);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    return await run(controller.signal);
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted)
      throw new NotificationTimeoutError(`Notification request timed out after ${options.timeout}ms.`, {
        provider,
        retryable: true,
        cause: error,
      });
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
export async function sendConcurrently<TName extends string, TRecipient, TNative, TResponse>(
  messages: readonly NotificationMessage<TRecipient, TNative>[],
  send: (message: NotificationMessage<TRecipient, TNative>) => Promise<NotificationResult<TName, TResponse>>,
  provider: TName,
  concurrency = 10,
): Promise<BatchNotificationResult<TName, TResponse>> {
  const results: NotificationResult<TName, TResponse>[] = Array.from({ length: messages.length });
  let next = 0;
  const worker = async () => {
    while (next < messages.length) {
      const index = next++;
      const message = messages[index];
      if (!message) continue;
      try {
        results[index] = await send(message);
      } catch (error) {
        results[index] = { ok: false, provider, status: 'failed', retryable: false, native: error as TResponse };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), messages.length) }, worker));
  return {
    provider,
    total: results.length,
    successCount: results.filter((r) => r.ok).length,
    failureCount: results.filter((r) => !r.ok).length,
    results,
  };
}
