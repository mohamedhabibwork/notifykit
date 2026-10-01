import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWhatsAppNotifier,
  parseWhatsAppWebhookEvent,
  verifyWhatsAppSignature,
} from "../src/whatsapp.js";

const webhookPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba-1",
      changes: [
        {
          field: "messages",
          value: {
            metadata: { phone_number_id: "pn-1" },
            statuses: [
              {
                id: "wamid.1",
                status: "delivered",
                timestamp: "1727770000",
                recipient_id: "15551234567",
                pricing: { category: "marketing" },
              },
            ],
          },
        },
      ],
    },
  ],
};

describe("WhatsApp Cloud API notifier", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends freeform text messages built from notification.body", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          messaging_product: "whatsapp",
          contacts: [{ wa_id: "15551234567" }],
          messages: [{ id: "wamid.9" }],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const whatsapp = await createWhatsAppNotifier({
      phoneNumberId: "pn-1",
      accessToken: "token",
    });
    const result = await whatsapp.send({
      to: { phoneNumber: "15551234567" },
      notification: { body: "Your code is 1234" },
    });
    expect(result).toMatchObject({ ok: true, provider: "whatsapp", messageId: "wamid.9" });
    expect(fetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v23.0/pn-1/messages",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer token" }),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: "15551234567",
          type: "text",
          text: { body: "Your code is 1234" },
        }),
      }),
    );
  });

  it("passes approved template messages through native", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid.2" }] })));
    vi.stubGlobal("fetch", fetch);
    const whatsapp = await createWhatsAppNotifier({
      phoneNumberId: "pn-1",
      accessToken: "token",
    });
    await whatsapp.send({
      to: { phoneNumber: "15551234567" },
      native: {
        type: "template",
        template: {
          name: "order_update",
          language: { code: "en_US" },
          components: [{ type: "body", parameters: [{ type: "text", text: "812" }] }],
        },
      },
    });
    const body = JSON.parse((fetch.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.type).toBe("template");
    expect(body.template.name).toBe("order_update");
    expect(body.template.components[0].parameters[0].text).toBe("812");
  });

  it("rejects malformed recipient numbers before any request", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const whatsapp = await createWhatsAppNotifier({
      phoneNumberId: "pn-1",
      accessToken: "token",
    });
    await expect(
      whatsapp.send({ to: { phoneNumber: "+15551234567" }, notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: false });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("maps expired tokens to authentication errors", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "Session expired", code: 190, type: "OAuthException" },
        }),
        { status: 401 },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const whatsapp = await createWhatsAppNotifier({
      phoneNumberId: "pn-1",
      accessToken: "token",
    });
    await expect(
      whatsapp.send({ to: { phoneNumber: "15551234567" }, notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: false });
  });

  it("surfaces throttling as a retryable rate limit with retry-after", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 130429, message: "Too many messages" } }), {
        status: 429,
        headers: { "retry-after": "7" },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const whatsapp = await createWhatsAppNotifier({
      phoneNumberId: "pn-1",
      accessToken: "token",
    });
    await expect(
      whatsapp.send({ to: { phoneNumber: "15551234567" }, notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: true, retryAfter: 7000 });
  });

  it("maps re-engagement and unknown-recipient codes to recipient errors", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 131047, message: "Re-engagement message required" },
        }),
        { status: 400 },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const whatsapp = await createWhatsAppNotifier({
      phoneNumberId: "pn-1",
      accessToken: "token",
    });
    await expect(
      whatsapp.send({ to: { phoneNumber: "15551234567" }, notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: false });
  });
});

describe("WhatsApp webhook helpers", () => {
  it("flattens status entries out of the webhook envelope", () => {
    const [status] = parseWhatsAppWebhookEvent(webhookPayload);
    expect(status).toMatchObject({
      messageId: "wamid.1",
      status: "delivered",
      timestamp: 1727770000,
      recipientPhone: "15551234567",
    });
  });

  it("verifies X-Hub-Signature-256 with the app secret", async () => {
    const signature = "sha256=9dc61d0f0eabb2f8ff5281977edcaec6a541c3c687d3f92abd30ef2af8128ef1";
    await expect(
      verifyWhatsAppSignature({
        appSecret: "app-secret",
        rawBody: "payload-body",
        signatureHeader: signature,
      }),
    ).resolves.toBe(true);
    await expect(
      verifyWhatsAppSignature({
        appSecret: "app-secret",
        rawBody: "tampered-body",
        signatureHeader: signature,
      }),
    ).resolves.toBe(false);
    await expect(
      verifyWhatsAppSignature({
        appSecret: "app-secret",
        rawBody: "payload-body",
        signatureHeader: "sha1=deadbeef",
      }),
    ).resolves.toBe(false);
  });
});
