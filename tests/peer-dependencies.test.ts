import { describe, expect, it } from "vitest";
import { importOptional } from "../src/core/dynamic-import.js";
import { NotificationConfigError } from "../src/core/errors.js";
import { createFcmNotifier } from "../src/fcm.js";
import { createFakeNotifier } from "../src/testing.js";

/**
 * NotifyKit itself has no runtime dependencies: fetch-based providers work
 * with nothing installed, SDK-backed providers load their optional peer only
 * when created, and the fake surface works everywhere in between.
 */
describe("optional peer dependencies", () => {
  it("sends with the fetch-based providers and fakes without any SDK installed", async () => {
    const notifier = createFakeNotifier<{ id: string }>();
    const result = await notifier.send({ to: { id: "1" }, notification: { body: "hello" } });
    expect(result.ok).toBe(true);
  });

  it("rejects an SDK-backed provider with an install hint when the SDK is absent", async () => {
    const error = await createFcmNotifier({
      credential: {
        projectId: "project",
        clientEmail: "service@example.com",
        privateKey: "private-key",
      },
    }).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(NotificationConfigError);
    expect((error as Error).message).toMatch(/npm install firebase-admin/);
  });

  it("loads optional packages by specifier at runtime, never at import time", async () => {
    await expect(importOptional("notifykit-not-an-installed-package")).rejects.toThrow();
  });
});
