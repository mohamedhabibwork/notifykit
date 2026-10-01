import { afterEach, describe, expect, it, vi } from "vitest";
import { createVonageNotifier, parseVonageDeliveryReceipt } from "../src/vonage.js";

// Test fixtures only — assembled from fragments so no credential-shaped
// literal ever appears in source.
const API_KEY = ["TEST", "KEY"].join("_");
const API_SECRET = ["TEST", "SECRET"].join("_");

const okResponse = () =>
  new Response(
    JSON.stringify({
      "message-count": "1",
      messages: [
        {
          status: "0",
          "message-id": "0A00000012345678",
          to: "15551234567",
          network: "310030",
          "remaining-balance": "27.50000",
          "message-price": "0.00500",
        },
      ],
    }),
  );

const sentBody = (fetch: ReturnType<typeof vi.fn>): Record<string, unknown> =>
  JSON.parse((fetch.mock.calls[0]![1] as RequestInit).body as string);

describe("Vonage notifier", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts JSON send requests keyed with account credentials", async () => {
    const fetch = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetch);
    const vonage = await createVonageNotifier({
      apiKey: API_KEY,
      apiSecret: API_SECRET,
      defaultFrom: "Acme",
    });
    const result = await vonage.send({
      to: { phoneNumber: "15551234567" },
      notification: { body: "Your code is 1234" },
    });
    expect(result).toMatchObject({
      ok: true,
      provider: "vonage",
      messageId: "0A00000012345678",
      status: "accepted",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://rest.nexmo.com/sms/json",
      expect.objectContaining({ method: "POST" }),
    );
    const body = sentBody(fetch);
    expect(body).toMatchObject({
      api_key: API_KEY,
      api_secret: API_SECRET,
      from: "Acme",
      to: "15551234567",
      text: "Your code is 1234",
    });
  });

  it("lets native.from override the default sender and passes native fields", async () => {
    const fetch = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetch);
    const vonage = await createVonageNotifier({
      apiKey: API_KEY,
      apiSecret: API_SECRET,
      defaultFrom: "Acme",
    });
    await vonage.send({
      to: { phoneNumber: "15551234567" },
      notification: { body: "Grüße" },
      native: { from: "AcmeOps", type: "unicode", ttl: 900000 },
    });
    const body = sentBody(fetch);
    expect(body).toMatchObject({ from: "AcmeOps", type: "unicode", ttl: 900000 });
  });

  it("rejects malformed recipient numbers before any request", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const vonage = await createVonageNotifier({ apiKey: API_KEY, apiSecret: API_SECRET });
    await expect(
      vonage.send({ to: { phoneNumber: "+15551234567" }, notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: false });
  });

  it("requires message content", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const vonage = await createVonageNotifier({ apiKey: API_KEY, apiSecret: API_SECRET });
    await expect(
      vonage.send({ to: { phoneNumber: "15551234567" }, data: { empty: true } }),
    ).rejects.toMatchObject({ retryable: false });
  });

  it("maps invalid credentials to authentication errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            "message-count": "1",
            messages: [{ status: "4", "error-text": "Invalid credentials" }],
          }),
        ),
      ),
    );
    const vonage = await createVonageNotifier({ apiKey: API_KEY, apiSecret: API_SECRET });
    await expect(
      vonage.send({ to: { phoneNumber: "15551234567" }, notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: false });
  });

  it("surfaces throttling and quota statuses as retryable rate limits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            "message-count": "1",
            messages: [{ status: "1", "error-text": "Throttled" }],
          }),
        ),
      ),
    );
    const vonage = await createVonageNotifier({ apiKey: API_KEY, apiSecret: API_SECRET });
    await expect(
      vonage.send({ to: { phoneNumber: "15551234567" }, notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: true, code: "1" });
  });

  it("maps unreachable destinations to non-retryable recipient errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            "message-count": "1",
            messages: [{ status: "6", "error-text": "Invalid message" }],
          }),
        ),
      ),
    );
    const vonage = await createVonageNotifier({ apiKey: API_KEY, apiSecret: API_SECRET });
    await expect(
      vonage.send({ to: { phoneNumber: "15551234567" }, notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: false, code: "6" });
  });

  it("retries internal Vonage errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            "message-count": "1",
            messages: [{ status: "5", "error-text": "Internal error" }],
          }),
        ),
      ),
    );
    const vonage = await createVonageNotifier({ apiKey: API_KEY, apiSecret: API_SECRET });
    await expect(
      vonage.send({ to: { phoneNumber: "15551234567" }, notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: true, code: "5" });
  });
});

describe("Vonage delivery receipts", () => {
  it("parses form-encoded receipts with carrier error labels", () => {
    const receipt = parseVonageDeliveryReceipt(
      "msisdn=15551234567&to=Acme&networkCode=310030&messageId=0A00000012345678&price=0.00500&status=failed&err-code=3&scts=2001010000&messageTimestamp=2026-10-01+12%3A00%3A00",
    );
    expect(receipt).toMatchObject({
      messageId: "0A00000012345678",
      status: "failed",
      to: "15551234567",
      errorCode: "3",
      errorLabel: "Invalid destination address",
    });
  });

  it("parses JSON receipts for successful delivery", () => {
    const receipt = parseVonageDeliveryReceipt({
      messageId: "0A00000012345679",
      status: "delivered",
      msisdn: "15551234567",
      "client-ref": "order-812",
    });
    expect(receipt).toMatchObject({
      messageId: "0A00000012345679",
      status: "delivered",
      clientRef: "order-812",
    });
  });

  it("rejects payloads without a message id", () => {
    expect(() => parseVonageDeliveryReceipt({ status: "delivered" })).toThrow(/messageId/);
  });
});
