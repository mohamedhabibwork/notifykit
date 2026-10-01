export type ApnsRecipient = { deviceToken: string } | { deviceTokens: readonly string[] };
export interface ApnsNativeOptions {
  /** The app's bundle ID (`apns-topic` header); required on real devices. */
  topic?: string;
  pushType?:
    | "alert"
    | "background"
    | "voip"
    | "complication"
    | "fileprovider"
    | "mdm"
    | "liveactivity";
  /** Unix timestamp (seconds) after which APNs may drop the notification. */
  expiration?: number;
  /** Delivery priority: 10 (immediate) or 5 (power-efficient). */
  priority?: 5 | 10;
  /** Notifications sharing this id replace each other in the tray. */
  collapseId?: string;
  /** Groups related notifications into one stack in Notification Center. */
  threadId?: string;
  /** Notification sound — a bundle filename or `default`. */
  sound?: string;
  /** Badge count shown on the app icon. */
  badge?: number;
  /** Silent background update (`aps.content-available: 1`). */
  contentAvailable?: boolean;
  /** Routes the notification through a Notification Service Extension. */
  mutableContent?: boolean;
  /** Groups into the app's registered category for action buttons. */
  category?: string;
  /** Safari-only arguments appended to the URL when launching. */
  urlArgs?: readonly string[];
  /**
   * Full custom `alert` object (localization keys, launch image, and so on).
   * Overrides the title/body derived from `message.notification`.
   */
  alert?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}
export interface ApnsResponse {
  sent?: readonly string[];
  failed?: readonly { device: string; response?: unknown; error?: unknown }[];
  [key: string]: unknown;
}
