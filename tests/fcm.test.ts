import { describe, expect, it } from "vitest";
import { fcmToNative } from "../src/drivers/fcm/driver.js";

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
