import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHuaweiProvider } from '../src/drivers/huawei/driver.js';
import type { HuaweiNativeClient, HuaweiTokenCache } from '../src/drivers/huawei/types.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('Huawei access tokens', () => {
  it('refreshes an expiring cache entry, exposes the token, and preserves mutable content', async () => {
    const cache: HuaweiTokenCache = {
      get: vi.fn().mockResolvedValue({ accessToken: 'stale', expiresAt: Date.now() + 1_000 }),
      set: vi.fn().mockResolvedValue(undefined),
    };
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/oauth2/v3/token')) {
        return new Response(JSON.stringify({ access_token: 'fresh', expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ requestId: 'request-1' }), { status: 200 });
    });
    globalThis.fetch = fetchMock;

    const provider = await createHuaweiProvider({
      type: 'huawei',
      appId: 'app-id',
      appSecret: 'app-secret',
      auth: { tokenCache: cache, refreshSkewMs: 30_000 },
    });
    const native = provider.native!() as HuaweiNativeClient;

    await expect(native.getAccessToken()).resolves.toMatchObject({ accessToken: 'fresh' });
    await provider.send({
      to: { token: 'device-token' },
      notification: { title: 'Image' },
      native: { apns: { payload: { aps: { mutableContent: true } } } },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cache.set).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'fresh' }));
    const request = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(request.message.apns.payload.aps.mutableContent).toBe(true);
  });
});
