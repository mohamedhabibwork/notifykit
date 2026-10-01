import { describe, expect, it, vi } from "vitest";
import {
  NotificationNetworkError,
  NotificationPayloadError,
  NotificationRateLimitError,
  createPreferenceFilter,
  dedupeMiddleware,
  dryRunMiddleware,
  rateLimitMiddleware,
  retryMiddleware,
  sendWithFallback,
  type NotificationResult,
} from "../src/index.js";
import { createFakeNotifier } from "../src/testing.js";

const msg = (id: string, extra: Record<string, unknown> = {}) => ({
  to: { id },
  notification: { body: "hi" },
  ...extra,
});

describe("retryMiddleware", () => {
  it("retries retryable errors with backoff and eventually succeeds", async () => {
    const notifier = createFakeNotifier();
    const sleep = vi.fn(async () => {});
    notifier.use(retryMiddleware({ retries: 3, minDelay: 10, factor: 2, jitter: false, sleep }));
    notifier.failNext(new NotificationNetworkError("down", { provider: "fake", retryable: true }));
    const result = await notifier.send(msg("a"));
    expect(result.ok).toBe(true);
    expect(sleep).toHaveBeenCalledWith(10);
  });
  it("does not retry non-retryable errors", async () => {
    const notifier = createFakeNotifier();
    const sleep = vi.fn(async () => {});
    notifier.use(retryMiddleware({ sleep }));
    notifier.failNext(new NotificationPayloadError("bad", { provider: "fake", retryable: false }));
    await expect(notifier.send(msg("a"))).rejects.toBeInstanceOf(NotificationPayloadError);
    expect(sleep).not.toHaveBeenCalled();
  });
  it("honours retryAfter seconds on rate-limit errors and gives up after retries", async () => {
    const sleep = vi.fn(async () => {});
    const middleware = retryMiddleware({ retries: 2, jitter: false, sleep });
    const error = new NotificationRateLimitError("slow", {
      provider: "fake",
      retryable: true,
      retryAfter: 3,
    });
    const next = vi.fn(async (): Promise<NotificationResult> => {
      throw error;
    });
    await expect(
      middleware({ provider: "fake", operation: "send", startedAt: 0 }, next),
    ).rejects.toBe(error);
    expect(next).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(3000);
  });
  it("retries failed results flagged retryable", async () => {
    const sleep = vi.fn(async () => {});
    const results: NotificationResult[] = [
      { ok: false, provider: "x", status: "failed", retryable: true, native: null },
      { ok: true, provider: "x", status: "sent", native: null },
    ];
    const result = await retryMiddleware({ sleep, jitter: false })(
      { provider: "x", operation: "send", startedAt: 0 },
      async () => results.shift()!,
    );
    expect(result.ok).toBe(true);
  });
});

describe("dryRunMiddleware", () => {
  it("short-circuits sends and reports the message", async () => {
    const notifier = createFakeNotifier();
    const onMessage = vi.fn();
    notifier.use(dryRunMiddleware({ onMessage }));
    const result = await notifier.send(msg("a"));
    expect(result).toMatchObject({ ok: true, status: "accepted", provider: "fake" });
    expect(notifier.messages()).toHaveLength(0);
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ to: { id: "a" } }), "fake");
  });
  it("passes through when disabled", async () => {
    const notifier = createFakeNotifier();
    notifier.use(dryRunMiddleware({ enabled: false }));
    await notifier.send(msg("a"));
    expect(notifier.messages()).toHaveLength(1);
  });
});

describe("dedupeMiddleware", () => {
  it("drops repeated idempotency keys within the window", async () => {
    let now = 0;
    const notifier = createFakeNotifier();
    notifier.use(dedupeMiddleware({ ttl: 1000, now: () => now }));
    const first = await notifier.send(msg("a", { idempotencyKey: "k1" }));
    const second = await notifier.send(msg("a", { idempotencyKey: "k1" }));
    expect(second).toEqual(first);
    await notifier.send(msg("a"));
    now = 2000;
    await notifier.send(msg("a", { idempotencyKey: "k1" }));
    expect(notifier.messages()).toHaveLength(3);
  });
  it("forgets keys whose send failed", async () => {
    const notifier = createFakeNotifier();
    notifier.use(dedupeMiddleware());
    notifier.failNext(new Error("boom"));
    await expect(notifier.send(msg("a", { idempotencyKey: "k" }))).rejects.toThrow("boom");
    await notifier.send(msg("a", { idempotencyKey: "k" }));
    expect(notifier.messages()).toHaveLength(1);
  });
});

describe("rateLimitMiddleware", () => {
  it("delays sends beyond the limit until the window frees up", async () => {
    let now = 0;
    const sleep = vi.fn(async (ms: number) => {
      now += ms;
    });
    const notifier = createFakeNotifier();
    notifier.use(rateLimitMiddleware({ limit: 2, interval: 1000, now: () => now, sleep }));
    await Promise.all([notifier.send(msg("a")), notifier.send(msg("b")), notifier.send(msg("c"))]);
    expect(notifier.messages()).toHaveLength(3);
    expect(sleep).toHaveBeenCalledWith(1000);
  });
  it("rejects invalid configuration", () => {
    expect(() => rateLimitMiddleware({ limit: 0, interval: 1000 })).toThrow();
  });
});

describe("sendWithFallback", () => {
  it("returns the first successful attempt and records failures", async () => {
    const primary = createFakeNotifier();
    const secondary = createFakeNotifier();
    primary.failNext(new Error("primary down"));
    const outcome = await sendWithFallback([
      () => primary.send(msg("a")),
      () => secondary.send(msg("a")),
    ]);
    expect(outcome.result?.ok).toBe(true);
    expect(outcome.attempt).toBe(1);
    expect(outcome.errors).toHaveLength(1);
    expect(secondary.messages()).toHaveLength(1);
  });
  it("reports failure when every attempt fails", async () => {
    const outcome = await sendWithFallback([
      async () => ({ ok: false, provider: "x", status: "failed", native: null }) as const,
    ]);
    expect(outcome.result).toBeUndefined();
    expect(outcome.errors).toHaveLength(1);
  });
});

describe("createPreferenceFilter", () => {
  it("applies global, category and quiet rules", () => {
    const allow = createPreferenceFilter({
      channels: { sms: false },
      categories: { marketing: { email: false } },
    });
    expect(allow("email")).toBe(true);
    expect(allow("sms")).toBe(false);
    expect(allow("email", "marketing")).toBe(false);
    expect(allow("push", "marketing")).toBe(true);
  });
});
