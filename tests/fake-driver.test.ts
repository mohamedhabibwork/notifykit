import { describe, expect, it } from 'vitest';
import { createNotifier } from '../src/index.js';
import { createFakeDriver } from '../src/testing.js';

const createFakeNotifierThroughFactory = async () => {
  const driver = createFakeDriver<{ id: string }>();
  const notifier = await createNotifier({ type: 'fake' }, { providers: [driver] });
  return { driver, notifier };
};

describe('fake driver', () => {
  it('builds a notifier through createNotifier and records sent messages', async () => {
    const { driver, notifier } = await createFakeNotifierThroughFactory();
    expect(notifier.name).toBe('fake');
    const result = await notifier.send({ to: { id: 'one' }, notification: { title: 'Hello' } });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe('fake');
    expect(result.messageId).toBe('1');
    expect(result.native).toEqual({ index: 0 });
    expect(driver.messages()).toHaveLength(1);
    expect(driver.lastMessage()?.to).toEqual({ id: 'one' });
  });

  it('batches through sendMany with concurrency', async () => {
    const { driver, notifier } = await createFakeNotifierThroughFactory();
    const batch = await notifier.sendMany(
      [
        { to: { id: 'one' }, data: { value: 1 } },
        { to: { id: 'two' }, data: { value: 2 } },
        { to: { id: 'three' }, data: { value: 3 } },
      ],
      { concurrency: 2 },
    );
    expect(batch.successCount).toBe(3);
    expect(driver.messages().map((message) => message.to.id)).toEqual(['one', 'two', 'three']);
  });

  it('shares one recorder across notifiers built from the same driver', async () => {
    const driver = createFakeDriver<{ id: string }>();
    const first = await createNotifier({ type: 'fake' }, { providers: [driver] });
    const second = await createNotifier({ type: 'fake' }, { providers: [driver] });
    await first.send({ to: { id: 'a' }, notification: { body: 'a' } });
    await second.send({ to: { id: 'b' }, notification: { body: 'b' } });
    expect(driver.messages().map((message) => message.to.id)).toEqual(['a', 'b']);
  });

  it('fails the next send after failNext and recovers afterwards', async () => {
    const { driver, notifier } = await createFakeNotifierThroughFactory();
    const failure = new Error('provider outage');
    driver.failNext(failure);
    await expect(notifier.send({ to: { id: 'one' }, data: {} })).rejects.toBe(failure);
    expect(driver.messages()).toHaveLength(0);
    const result = await notifier.send({ to: { id: 'one' }, data: {} });
    expect(result.ok).toBe(true);
    expect(driver.messages()).toHaveLength(1);
  });

  it('clears recorded messages', async () => {
    const { driver, notifier } = await createFakeNotifierThroughFactory();
    await notifier.send({ to: { id: 'one' }, notification: { body: 'x' } });
    driver.clear();
    expect(driver.messages()).toHaveLength(0);
    expect(driver.lastMessage()).toBeUndefined();
  });

  it('applies latency to sends', async () => {
    const { driver, notifier } = await createFakeNotifierThroughFactory();
    driver.setLatency(5);
    const startedAt = Date.now();
    await notifier.send({ to: { id: 'one' }, notification: { body: 'slow' } });
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(5);
  });

  it('merges capability overrides from options and config', async () => {
    const driver = createFakeDriver<{ id: string }>({ capabilities: { token: true } });
    const notifier = await createNotifier(
      { type: 'fake', capabilities: { image: true, notification: false } },
      { providers: [driver] },
    );
    expect(notifier.capabilities).toMatchObject({
      single: true,
      batch: true,
      token: true,
      image: true,
      notification: false,
    });
  });

  it('works with middleware and hooks like a real driver', async () => {
    const driver = createFakeDriver<{ id: string }>();
    const notifier = await createNotifier({ type: 'fake' }, { providers: [driver] });
    const providers: string[] = [];
    notifier.use((context, next) => {
      providers.push(context.provider);
      return next();
    });
    await notifier.send({ to: { id: 'one' }, notification: { body: 'x' } });
    expect(providers).toEqual(['fake']);
    expect(driver.messages()).toHaveLength(1);
  });
});
