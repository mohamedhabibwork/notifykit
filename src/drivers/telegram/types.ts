export type TelegramRecipient = { chatId: string | number } | { channel: string };
export interface TelegramNativeOptions { parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'; disable_notification?: boolean; disable_web_page_preview?: boolean; protect_content?: boolean; message_thread_id?: number; reply_markup?: { inline_keyboard?: readonly (readonly { text: string; url?: string; callback_data?: string }[])[] }; }
export interface TelegramResponse { ok: boolean; result?: { message_id?: number; [key: string]: unknown }; description?: string; error_code?: number; [key: string]: unknown; }
