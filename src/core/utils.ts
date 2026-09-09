import { NotificationPayloadError, NotificationTimeoutError } from './errors.js';
import type {
  BatchNotificationResult,
  NotificationMessage,
  NotificationMessageSource,
  NotificationResult,
  SendOptions,
} from './types.js';
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
  messages: NotificationMessageSource<TRecipient, TNative>,
  send: (message: NotificationMessage<TRecipient, TNative>) => Promise<NotificationResult<TName, TResponse>>,
  provider: TName,
  concurrency = 10,
): Promise<BatchNotificationResult<TName, TResponse>> {
  if (Array.isArray(messages)) return sendArrayConcurrently(messages, send, provider, concurrency);
  const results: NotificationResult<TName, TResponse>[] = [];
  for await (const result of sendAsCompleted(messages, send, provider, concurrency)) results.push(result);
  return {
    provider,
    total: results.length,
    successCount: results.filter((result) => result.ok).length,
    failureCount: results.filter((result) => !result.ok).length,
    results,
  };
}

async function sendArrayConcurrently<TName extends string, TRecipient, TNative, TResponse>(
  messages: readonly NotificationMessage<TRecipient, TNative>[],
  send: (message: NotificationMessage<TRecipient, TNative>) => Promise<NotificationResult<TName, TResponse>>,
  provider: TName,
  concurrency: number,
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
    successCount: results.filter((result) => result.ok).length,
    failureCount: results.filter((result) => !result.ok).length,
    results,
  };
}

/**
 * Sends messages with bounded concurrency and yields each completed result.
 * Unlike sendConcurrently, this never retains the complete input or result set.
 */
export async function* sendAsCompleted<TName extends string, TRecipient, TNative, TResponse>(
  messages: NotificationMessageSource<TRecipient, TNative>,
  send: (message: NotificationMessage<TRecipient, TNative>) => Promise<NotificationResult<TName, TResponse>>,
  provider: TName,
  concurrency = 10,
): AsyncGenerator<NotificationResult<TName, TResponse>> {
  const iterator = isAsyncIterable(messages)
    ? messages[Symbol.asyncIterator]()
    : (messages as Iterable<NotificationMessage<TRecipient, TNative>>)[Symbol.iterator]();
  const limit = Math.max(1, Math.floor(concurrency) || 1);
  type Completion = { task: Promise<Completion>; result: NotificationResult<TName, TResponse> };
  const inFlight = new Set<Promise<Completion>>();
  let exhausted = false;
  const startNext = async (): Promise<boolean> => {
    const next = await iterator.next();
    if (next.done) return false;
    const result = send(next.value).catch((error): NotificationResult<TName, TResponse> => ({
      ok: false,
      provider,
      status: 'failed',
      retryable: false,
      native: error as TResponse,
    }));
    let task: Promise<Completion>;
    task = result.then((completed) => ({ task, result: completed }));
    inFlight.add(task);
    return true;
  };
  while (!exhausted && inFlight.size < limit) exhausted = !(await startNext());
  while (inFlight.size > 0) {
    const completed = await Promise.race(inFlight);
    inFlight.delete(completed.task);
    yield completed.result;
    while (!exhausted && inFlight.size < limit) exhausted = !(await startNext());
  }
}

function isAsyncIterable<T>(value: Iterable<T> | AsyncIterable<T>): value is AsyncIterable<T> {
  return Symbol.asyncIterator in value;
}
