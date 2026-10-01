export type SlackRecipient = { channel: string } | { webhookUrl?: string };

/** Additional fields accepted by Slack chat.postMessage and incoming webhooks. */
export interface SlackNativeOptions {
  blocks?: readonly Record<string, unknown>[];
  attachments?: readonly Record<string, unknown>[];
  thread_ts?: string;
  reply_broadcast?: boolean;
  /** Send as the authed user instead of the bot's default identity (chat.postMessage only). */
  as_user?: boolean;
  /** Enable @channel/@user/group and #channel links and URL autolinking in text. */
  link_names?: boolean;
  /** Structured application metadata (event_type/event_payload) attached to the message. */
  metadata?: { event_type: string; event_payload: Record<string, unknown> };
  /** Change how links are unfurled; legacy alternative to unfurl_links/unfurl_media. */
  parse?: "none" | "full";
  unfurl_links?: boolean;
  unfurl_media?: boolean;
  username?: string;
  icon_emoji?: string;
  icon_url?: string;
  mrkdwn?: boolean;
}

export interface SlackResponse {
  ok: boolean;
  channel?: string;
  ts?: string;
  error?: string;
  [key: string]: unknown;
}
