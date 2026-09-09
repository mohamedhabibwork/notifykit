export interface SlackConfig {
  type: 'slack';
  /** Bot token used with Slack's chat.postMessage API. */
  botToken?: string;
  /** Default incoming-webhook URL. A per-message URL can override this. */
  webhookUrl?: string;
  apiUrl?: string;
}

export type SlackNotifierConfig = Omit<SlackConfig, 'type'>;
