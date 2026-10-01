import { describe, expect, it, vi } from "vitest";
import { createNotificationManager, type KitLogger } from "../src/index.js";

const spyLogger = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn<KitLogger["error"]>(),
});

describe("manager logger integration", () => {
  it("reports provider creation failures to the injected logger and retries later", async () => {
    const logger = spyLogger();
    const manager = createNotificationManager({
      providers: { bad: { type: "does-not-exist" } as never },
      logger,
    });

    await expect(manager.provider("bad")).rejects.toThrow();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0]?.[1]).toBeInstanceOf(Error);

    await expect(manager.provider("bad")).rejects.toThrow();
    expect(logger.error).toHaveBeenCalledTimes(2); // failed instance was evicted
  });
});

describe("manager delivery helpers", () => {
  const providers = {
    a: { type: "custom", driver: "x" },
    b: { type: "custom", driver: "x" },
  };
  it("filters sendMulti channels and falls back across providers", async () => {
    const { createFakeNotifier } = await import("../src/testing.js");
    const fakes = { a: createFakeNotifier(), b: createFakeNotifier() };
    const manager = createNotificationManager({ providers: providers as never });
    (manager as unknown as { provider: (n: "a" | "b") => unknown }).provider = async (
      name: "a" | "b",
    ) => fakes[name];
    const message = { to: { id: "1" }, notification: { body: "x" } };
    const sent = await manager.sendMulti(
      [
        { provider: "a", message },
        { provider: "b", message },
      ] as never,
      { filter: (name) => name !== "b" },
    );
    expect(sent).toHaveLength(1);
    fakes.a.failNext(new Error("down"));
    const outcome = await manager.sendFallback([
      { provider: "a", message },
      { provider: "b", message },
    ] as never);
    expect(outcome.provider).toBe("b");
    expect(fakes.b.messages()).toHaveLength(1);
  });
});
