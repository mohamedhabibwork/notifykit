import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTwilioNotifier,
  parseTwilioStatusCallback,
  verifyTwilioSignature,
} from "../src/twilio.js";

// Test fixtures only — assembled from fragments so no credential-shaped
// literal ever appears in source.
const AUTH_TOKEN = ["TEST", "AUTH", "TOKEN"].join("_");
const WRONG_AUTH_TOKEN = ["TEST", "WRONG", "TOKEN"].join("_");
const ACCOUNT_SID = ["AC", "0123456789", "abcdef", "0123456789", "abcdef"].join("");

const notifier = (extra?: Partial<Parameters<typeof createTwilioNotifier>[0]>) =>
  createTwilioNotifier({
    accountSid: ACCOUNT_SID,
    authToken: AUTH_TOKEN,
    from: "+15550001111",
    ...extra,
  });

const okResponse = () =>
  new Response(
    JSON.stringify({
      sid: "SM8f10c9bb1",
      status: "queued",
      to: "+15551234567",
      from: "+15550001111",
    }),
  );

const sentBody = (fetch: ReturnType<typeof vi.fn>): URLSearchParams =>
  new URLSearchParams((fetch.mock.calls[0]![1] as RequestInit).body as string);

describe("Twilio notifier", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts form-encoded messages with basic auth and status callbacks", async () => {
    const fetch = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetch);
    const twilio = await notifier({ statusCallbackUrl: "https://example.test/twilio" });
    const result = await twilio.send({
      to: { phoneNumber: "+15551234567" },
      notification: { body: "Your code is 1234" },
    });
    expect(result).toMatchObject({
      ok: true,
      provider: "twilio",
      messageId: "SM8f10c9bb1",
      status: "accepted",
    });
    expect(fetch).toHaveBeenCalledWith(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: `Basic ${btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`)}`,
        }),
      }),
    );
    const params = sentBody(fetch);
    expect(params.get("To")).toBe("+15551234567");
    expect(params.get("From")).toBe("+15550001111");
    expect(params.get("Body")).toBe("Your code is 1234");
    expect(params.get("StatusCallback")).toBe("https://example.test/twilio");
  });

  it("supports Messaging Service senders and Content API templates", async () => {
    const fetch = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetch);
    const twilio = await notifier({
      from: undefined,
      messagingServiceSid: "MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    });
    await twilio.send({
      to: { phoneNumber: "+15551234567" },
      notification: { body: "Reminder" },
      native: {
        contentSid: "HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        contentVariables: { code: "812" },
      },
    });
    const params = sentBody(fetch);
    expect(params.get("MessagingServiceSid")).toBe("MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    expect(params.get("ContentSid")).toBe("HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    expect(JSON.parse(params.get("ContentVariables")!)).toEqual({ code: "812" });
  });

  it("routes whatsapp: recipients through the same channel", async () => {
    const fetch = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetch);
    const twilio = await notifier({ from: "whatsapp:+15550001111" });
    await twilio.send({
      to: { phoneNumber: "whatsapp:+15551234567" },
      notification: { body: "hi" },
    });
    const params = sentBody(fetch);
    expect(params.get("To")).toBe("whatsapp:+15551234567");
    expect(params.get("From")).toBe("whatsapp:+15550001111");
  });

  it("rejects messages with no configured sender", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const twilio = await notifier({ from: undefined });
    await expect(
      twilio.send({ to: { phoneNumber: "+15551234567" }, notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: false });
  });

  it("rejects invalid recipient shapes before any request", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const twilio = await notifier();
    await expect(
      twilio.send({ to: { phoneNumber: "15551234567" }, notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: false });
  });

  it("maps rejected credentials to authentication errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ code: 20003, message: "Authenticate" }), { status: 401 }),
        ),
    );
    const twilio = await notifier();
    await expect(
      twilio.send({ to: { phoneNumber: "+15551234567" }, notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: false });
  });

  it("surfaces throttling as a retryable rate limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 20429, message: "Too Many Requests" }), {
          status: 429,
          headers: { "retry-after": "5" },
        }),
      ),
    );
    const twilio = await notifier();
    await expect(
      twilio.send({ to: { phoneNumber: "+15551234567" }, notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: true, retryAfter: 5000 });
  });

  it("maps blacklisted recipients to non-retryable recipient errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ code: 21610, message: "Cannot send to who have opted out" }),
            { status: 400 },
          ),
        ),
    );
    const twilio = await notifier();
    await expect(
      twilio.send({ to: { phoneNumber: "+15551234567" }, notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: false, code: "21610" });
  });
});

describe("Twilio status callbacks", () => {
  const params = "MessageSid=SM8f10c9bb1&MessageStatus=delivered&To=%2B15551234567&ErrorCode=0";

  it("parses form-encoded callbacks", () => {
    const status = parseTwilioStatusCallback(params);
    expect(status).toMatchObject({
      messageSid: "SM8f10c9bb1",
      status: "delivered",
      to: "+15551234567",
    });
    expect(status.whatsapp).toBe(false);
  });

  it("flags whatsapp recipients and passes error details through", () => {
    const status = parseTwilioStatusCallback({
      MessageSid: "SM1",
      MessageStatus: "failed",
      To: "whatsapp:+15551234567",
      ErrorCode: "63016",
      ErrorMessage: "Failed to send freeform message",
    });
    expect(status.whatsapp).toBe(true);
    expect(status).toMatchObject({ status: "failed", errorCode: 63016 });
  });

  it("rejects payloads without a message sid", () => {
    expect(() => parseTwilioStatusCallback({ MessageStatus: "sent" })).toThrow(/MessageSid/);
  });

  it("verifies X-Twilio-Signature built per the documented algorithm", async () => {
    const data =
      "https://example.com/webhook" +
      "ErrorCode0" +
      "MessageSidSM8f10c9bb1" +
      "MessageStatusdelivered" +
      "To+15551234567";
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(AUTH_TOKEN),
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"],
    );
    const expected = btoa(
      String.fromCharCode(
        ...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data))),
      ),
    );
    await expect(
      verifyTwilioSignature({
        authToken: AUTH_TOKEN,
        url: "https://example.com/webhook",
        params,
        signatureHeader: expected,
      }),
    ).resolves.toBe(true);
    await expect(
      verifyTwilioSignature({
        authToken: WRONG_AUTH_TOKEN,
        url: "https://example.com/webhook",
        params,
        signatureHeader: expected,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyTwilioSignature({
        authToken: AUTH_TOKEN,
        url: "https://example.com/webhook",
        params,
        signatureHeader: undefined,
      }),
    ).resolves.toBe(false);
  });
});
