import { afterEach, describe, expect, it, vi } from "vitest";
import { createTelegramNotifier } from "../src/telegram.js";

describe("Telegram notifier", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends chat messages with native options passed through", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 7 } })));
    vi.stubGlobal("fetch", fetch);
    const telegram = await createTelegramNotifier({ botToken: "token" });
    const result = await telegram.send({
      to: { chatId: 42 },
      notification: { title: "Deploy", body: "Build #812 passed" },
      native: {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_parameters: { message_id: 5 },
        message_thread_id: 3,
      },
    });
    expect(result).toMatchObject({ ok: true, provider: "telegram", messageId: "7" });
    expect(fetch).toHaveBeenCalledWith(
      "https://api.telegram.org/bottoken/sendMessage",
      expect.objectContaining({
        body: JSON.stringify({
          chat_id: 42,
          text: "Build #812 passed",
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
          reply_parameters: { message_id: 5 },
          message_thread_id: 3,
        }),
      }),
    );
  });

  it("surfaces rate limits as retryable errors", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, description: "Too Many Requests" }), {
        status: 429,
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const telegram = await createTelegramNotifier({ botToken: "token" });
    await expect(
      telegram.send({ to: { chatId: 42 }, notification: { body: "hi" } }),
    ).rejects.toMatchObject({ retryable: true });
  });
});
