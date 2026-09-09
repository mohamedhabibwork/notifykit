import { describe, expect, it } from 'vitest';
import { NotificationPayloadError } from '../src/core/errors.js';
import { createFakeNotifier } from '../src/testing.js';
describe('fake notifier', () => {
  it('records and batches messages', async () => {
    const notifier = createFakeNotifier<{ id: string }>();
    const result = await notifier.send({ to: { id: 'one' }, notification: { title: 'Hello' } });
    expect(result.ok).toBe(true);
    const batch = await notifier.sendMany(
      [
        { to: { id: 'two' }, notification: { body: 'Two' } },
        { to: { id: 'three' }, data: { value: 3 } },
      ],
      { concurrency: 1 },
    );
    expect(batch.successCount).toBe(2);
    expect(notifier.messages()).toHaveLength(3);
  });
  it('checks universal payload invariants', async () => {
    const notifier = createFakeNotifier<{ id: string }>();
    await expect(notifier.send({ to: { id: 'one' }, ttl: -1, notification: { body: 'x' } })).rejects.toBeInstanceOf(
      NotificationPayloadError,
    );
  });
  it('streams generator input with bounded concurrency without collecting results', async () => {
    const notifier = createFakeNotifier<{ id: string }>();
    function* messages() {
      for (let id = 0; id < 1_000; id++) yield { to: { id: String(id) }, notification: { body: 'bulk' } };
    }
    let count = 0;
    for await (const result of notifier.sendEach(messages(), { concurrency: 3 })) {
      expect(result.ok).toBe(true);
      count++;
    }
    expect(count).toBe(1_000);
    expect(notifier.messages()).toHaveLength(1_000);
  });
});
