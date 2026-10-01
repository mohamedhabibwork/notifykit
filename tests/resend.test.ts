import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createResendNotifier,
  parseResendWebhookEvent,
  verifyResendWebhook,
} from "../src/resend.js";

// Test fixtures only — assembled from fragments so no credential-shaped
// literal ever appears in source.
const API_KEY = ["re", "TEST", "KEY"].join("_");
const SIGNING_SECRET = ["whsec", "TEST", "SECRET"].join("_");
const WRONG_SIGNING_SECRET = ["whsec", "WRONG", "SECRET"].join("_");

const okResponse = () =>
  new Response(JSON.stringify({ id: "4ef9a417-02e9-4d39-ad75-9613e8faa96c" }));

describe("Resend notifier", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends emails with bearer auth and default sender", async () => {
    const fetch = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetch);
    const resend = await createResendNotifier({
      apiKey: API_KEY,
      defaultFrom: { email: "alerts@example.test", name: "Acme Alerts" },
    });
    const result = await resend.send({
      to: [{ email: "user@example.test", name: "Ada" }, "ops@example.test"],
      notification: { title: "Deploy finished", body: "Build #812 passed" },
      native: { replyTo: "support@example.test", cc: "qa@example.test" },
    });
    expect(result).toMatchObject({
      ok: true,
      provider: "resend",
      messageId: "4ef9a417-02e9-4d39-ad75-9613e8faa96c",
      status: "accepted",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: `Bearer ${API_KEY}` }),
        body: JSON.stringify({
          from: "Acme Alerts <alerts@example.test>",
          to: ["Ada <user@example.test>", "ops@example.test"],
          subject: "Deploy finished",
          text: "Build #812 passed",
          html: undefined,
          reply_to: ["support@example.test"],
          cc: ["qa@example.test"],
        }),
      }),
    );
  });

  it("lets native.from override the default sender and sends html bodies", async () => {
    const fetch = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetch);
    const resend = await createResendNotifier({
      apiKey: API_KEY,
      defaultFrom: "alerts@example.test",
    });
    await resend.send({
      to: "user@example.test",
      notification: { title: "Digest" },
      native: {
        from: "digest@example.test",
        html: "<h1>Digest</h1>",
        tags: [{ name: "kind", value: "digest" }],
      },
    });
    const body = JSON.parse((fetch.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.from).toBe("digest@example.test");
    expect(body.html).toBe("<h1>Digest</h1>");
    expect(body.tags).toEqual([{ name: "kind", value: "digest" }]);
  });

  it("encodes binary attachments as base64 content", async () => {
    const fetch = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetch);
    const resend = await createResendNotifier({ apiKey: API_KEY, defaultFrom: "a@e.test" });
    await resend.send({
      to: "user@example.test",
      notification: { title: "Report" },
      native: {
        html: "<p>ok</p>",
        attachments: [{ filename: "log.txt", content: new TextEncoder().encode("hello") }],
      },
    });
    const body = JSON.parse((fetch.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.attachments[0].content).toBe(btoa("hello"));
  });

  it("rejects messages with no sender configured", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const resend = await createResendNotifier({ apiKey: API_KEY });
    await expect(
      resend.send({ to: "user@example.test", notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: false });
  });

  it("rejects messages with no content", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const resend = await createResendNotifier({ apiKey: API_KEY, defaultFrom: "a@e.test" });
    await expect(
      resend.send({ to: "user@example.test", data: { empty: true } }),
    ).rejects.toMatchObject({ retryable: false });
  });

  it("maps rejected keys to authentication errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ name: "unauthorized", message: "Invalid API key" }), {
          status: 401,
        }),
      ),
    );
    const resend = await createResendNotifier({ apiKey: API_KEY, defaultFrom: "a@e.test" });
    await expect(
      resend.send({ to: "user@example.test", notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: false });
  });

  it("surfaces rate limits as retryable with retry-after", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ name: "rate_limit_exceeded", message: "Slow down" }), {
          status: 429,
          headers: { "retry-after": "60" },
        }),
      ),
    );
    const resend = await createResendNotifier({ apiKey: API_KEY, defaultFrom: "a@e.test" });
    await expect(
      resend.send({ to: "user@example.test", notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: true, retryAfter: 60000 });
  });

  it("maps validation failures to payload errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ name: "validation_error", message: "Invalid to" }), {
          status: 422,
        }),
      ),
    );
    const resend = await createResendNotifier({ apiKey: API_KEY, defaultFrom: "a@e.test" });
    await expect(
      resend.send({ to: "user@example.test", notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: false });
  });

  it("retries server errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ name: "internal_error", message: "boom" }), {
          status: 500,
        }),
      ),
    );
    const resend = await createResendNotifier({ apiKey: API_KEY, defaultFrom: "a@e.test" });
    await expect(
      resend.send({ to: "user@example.test", notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: true });
  });
});

describe("Resend webhook helpers", () => {
  const rawBody = JSON.stringify({
    type: "email.delivered",
    created_at: "2026-10-01T12:00:00.000Z",
    data: { email_id: "4ef9a417-02e9-4d39-ad75-9613e8faa96c", to: ["user@example.test"] },
  });

  const sign = async (secret: string, content: string): Promise<string> => {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret.replace(/^whsec_/, "")),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    return btoa(
      String.fromCharCode(
        ...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(content))),
      ),
    );
  };

  it("verifies Svix signatures within the replay tolerance", async () => {
    const id = "evt_1";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await sign(SIGNING_SECRET, `${id}.${timestamp}.${rawBody}`);
    await expect(
      verifyResendWebhook({
        signingSecret: SIGNING_SECRET,
        rawBody,
        id,
        timestamp,
        signatureHeader: `v1,${signature}`,
      }),
    ).resolves.toBe(true);
  });

  it("rejects tampered bodies, wrong secrets, stale timestamps, and missing headers", async () => {
    const id = "evt_1";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await sign(SIGNING_SECRET, `${id}.${timestamp}.${rawBody}`);
    await expect(
      verifyResendWebhook({
        signingSecret: SIGNING_SECRET,
        rawBody: JSON.stringify({ type: "email.delivered", data: { email_id: "evil" } }),
        id,
        timestamp,
        signatureHeader: `v1,${signature}`,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyResendWebhook({
        signingSecret: WRONG_SIGNING_SECRET,
        rawBody,
        id,
        timestamp,
        signatureHeader: `v1,${signature}`,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyResendWebhook({
        signingSecret: SIGNING_SECRET,
        rawBody,
        id,
        timestamp: String(Math.floor(Date.now() / 1000) - 3600),
        signatureHeader: `v1,${signature}`,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyResendWebhook({
        signingSecret: SIGNING_SECRET,
        rawBody,
        id,
        timestamp,
        signatureHeader: undefined,
      }),
    ).resolves.toBe(false);
  });

  it("parses delivery events joined by email id", () => {
    const event = parseResendWebhookEvent(JSON.parse(rawBody));
    expect(event).toMatchObject({
      type: "email.delivered",
      emailId: "4ef9a417-02e9-4d39-ad75-9613e8faa96c",
      to: ["user@example.test"],
    });
  });

  it("rejects payloads without a known event type", () => {
    expect(() => parseResendWebhookEvent({})).toThrow(/type/);
    expect(() => parseResendWebhookEvent({ type: "email.teleported" })).toThrow(/Unknown Resend/);
  });
});
