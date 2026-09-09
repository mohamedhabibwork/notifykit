import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSlackNotifier } from '../src/slack.js';

describe('Slack notifier', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends a channel message through chat.postMessage', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, channel: 'C123', ts: '42.1' })));
    vi.stubGlobal('fetch', fetch);
    const slack = await createSlackNotifier({ botToken: 'xoxb-token' });
    const result = await slack.send({ to: { channel: 'C123' }, notification: { body: 'Release complete' } });
    expect(result).toMatchObject({ ok: true, provider: 'slack', messageId: '42.1' });
    expect(fetch).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({ body: JSON.stringify({ channel: 'C123', text: 'Release complete' }) }),
    );
  });

  it('supports incoming webhooks for channels without a bot token', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetch);
    const slack = await createSlackNotifier({ webhookUrl: 'https://hooks.slack.com/services/test' });
    await expect(slack.send({ to: {}, notification: { title: 'Alert' } })).resolves.toMatchObject({ ok: true });
    expect(fetch).toHaveBeenCalledWith('https://hooks.slack.com/services/test', expect.any(Object));
  });
});
