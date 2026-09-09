export type SlackRecipient = { channel: string } | { webhookUrl?: string };

/** Additional fields accepted by Slack chat.postMessage and incoming webhooks. */
export interface SlackNativeOptions {
  blocks?: readonly Record<string, unknown>[];
  attachments?: readonly Record<string, unknown>[];
  thread_ts?: string;
  reply_broadcast?: boolean;
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
