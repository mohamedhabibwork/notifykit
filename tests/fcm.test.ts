import { describe, expect, it, vi } from "vitest";
import { fcmToNative } from "../src/drivers/fcm/driver.js";

vi.mock("../src/core/dynamic-import.js", () => ({
  importOptional: vi.fn(),
}));

describe("FCM APNs collapse/thread mapping", () => {
  it("maps collapseId and threadId to the APNs header and aps payload", () => {
    const message = fcmToNative({
      to: { token: "device-token" },
      notification: { title: "Chat", body: "New message" },
      native: { apns: { collapseId: "conv-42", threadId: "thread-7" } },
    });

    expect(message.apns).toEqual({
      headers: { "apns-collapse-id": "conv-42" },
      payload: { aps: { "thread-id": "thread-7" } },
      fcmOptions: undefined,
    });
  });

  it("preserves raw headers and payload alongside the shorthand fields", () => {
    const message = fcmToNative({
      to: { token: "device-token" },
      notification: { title: "Chat" },
      native: {
        apns: {
          collapseId: "conv-42",
          threadId: "thread-7",
          headers: { "apns-priority": "10" },
          payload: { aps: { alert: "hi", sound: "ping" } },
        },
      },
    });

    expect(message.apns).toEqual({
      headers: { "apns-priority": "10", "apns-collapse-id": "conv-42" },
      payload: { aps: { alert: "hi", sound: "ping", "thread-id": "thread-7" } },
      fcmOptions: undefined,
    });
  });

  it("leaves apns untouched when no shorthand fields are set", () => {
    const message = fcmToNative({
      to: { topic: "news" },
      notification: { title: "News" },
      native: { apns: { headers: { "apns-expiration": "0" } } },
    });

    expect(message.apns).toEqual({
      headers: { "apns-expiration": "0" },
      payload: {},
      fcmOptions: undefined,
    });
  });

  it("defaults android options from core priority, ttl, and collapseKey", () => {
    const message = fcmToNative({
      to: { token: "device-token" },
      notification: { title: "Chat" },
      priority: "high",
      ttl: 3600,
      collapseKey: "inbox",
    });

    expect(message.android).toEqual({ priority: "high", ttl: 3600, collapseKey: "inbox" });
  });

  it("lets native.android override the core-level defaults", () => {
    const message = fcmToNative({
      to: { token: "device-token" },
      notification: { title: "Chat" },
      priority: "normal",
      collapseKey: "inbox",
      native: {
        android: {
          priority: "high",
          collapseKey: "conversation",
          notification: { channelId: "x" },
        },
      },
    });

    expect(message.android).toEqual({
      priority: "high",
      collapseKey: "conversation",
      notification: { channelId: "x" },
    });
  });

  it("omits android entirely when no priority/ttl/collapseKey apply", () => {
    const message = fcmToNative({
      to: { token: "device-token" },
      notification: { title: "Chat" },
    });

    expect(message.android).toBeUndefined();
  });
});

describe("FCM provider admin module resolution", () => {
  it("resolves cert from credential.cert on the ESM interop default namespace", async () => {
    const { createFcmProvider } = await import("../src/drivers/fcm/driver.js");
    const { importOptional } = await import("../src/core/dynamic-import.js");
    const certCalls: unknown[] = [];
    const firebaseNamespace = {
      __esModule: true,
      INTERNAL: {},
      Promise,
      SDK_VERSION: "13.10.0-test",
      credential: {
        cert: (value: unknown) => {
          certCalls.push(value);
          return {
            getAccessToken: async () => ({ access_token: "token", expires_in: 3600 }),
          };
        },
      },
      default: null as unknown,
      initializeApp: () => ({ name: "test-app" }),
      app: (name?: string) => ({ name: name ?? "test-app" }),
      messaging: () => ({ send: async () => "projects/p/messages/1" }),
    };
    firebaseNamespace.default = firebaseNamespace;
    const importMock = vi.mocked(importOptional);
    importMock.mockResolvedValue({
      INTERNAL: firebaseNamespace.INTERNAL,
      Promise,
      SDK_VERSION: firebaseNamespace.SDK_VERSION,
      credential: firebaseNamespace.credential,
      default: firebaseNamespace,
    } as never);

    const provider = await createFcmProvider({
      type: "fcm",
      credential: {
        serviceAccount: {
          clientEmail: "sender@trips.iam.gserviceaccount.com",
          projectId: "trips",
        },
      },
    } as Parameters<typeof createFcmProvider>[0]);

    expect(certCalls).toHaveLength(1);
    expect(provider).toBeDefined();
  });
});
