export interface NotificationPreferences {
  /** Global per-channel opt-in/out; missing channels are allowed. */
  channels?: Readonly<Record<string, boolean>>;
  /** Per-category overrides, e.g. `{ marketing: { email: false } }`. */
  categories?: Readonly<Record<string, Readonly<Record<string, boolean>>>>;
}

export type ChannelFilter = (channel: string, category?: string) => boolean;

/** Turns stored user preferences into a predicate usable with `manager.sendMulti(..., { filter })`. */
export function createPreferenceFilter(preferences: NotificationPreferences): ChannelFilter {
  return (channel, category) => {
    const categoryRule = category ? preferences.categories?.[category]?.[channel] : undefined;
    if (categoryRule !== undefined) return categoryRule;
    return preferences.channels?.[channel] ?? true;
  };
}
