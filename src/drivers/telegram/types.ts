export type TelegramRecipient = { chatId: string | number } | { channel: string };
export interface TelegramNativeOptions {
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  /** Special entities (bold, links, mentions) in the text — precise alternative to parse_mode. */
  entities?: readonly {
    type: string;
    offset: number;
    length: number;
    url?: string;
    language?: string;
  }[];
  disable_notification?: boolean;
  /** Official replacement for the deprecated `disable_web_page_preview`. */
  link_preview_options?: {
    is_disabled?: boolean;
    url?: string;
    prefer_small_media?: boolean;
    prefer_large_media?: boolean;
    show_above_text?: boolean;
  };
  disable_web_page_preview?: boolean;
  protect_content?: boolean;
  /** Unique identifier of a forum topic to send to. */
  message_thread_id?: number;
  /** Message effect (animation) shown on delivery, private chats only. */
  message_effect_id?: string;
  /** Description of the message to reply to. */
  reply_parameters?: {
    message_id: number;
    quote?: string;
    quote_parse_mode?: string;
    quote_entities?: unknown[];
    allow_sending_without_reply?: boolean;
  };
  reply_markup?: {
    inline_keyboard?: readonly (readonly {
      text: string;
      url?: string;
      callback_data?: string;
    }[])[];
  };
}
export interface TelegramResponse {
  ok: boolean;
  result?: { message_id?: number; [key: string]: unknown };
  description?: string;
  error_code?: number;
  [key: string]: unknown;
}
