import type { ResendAddress } from "./types.js";

export interface ResendConfig {
  type: "resend";
  /** Resend API key (starts with re_…). */
  apiKey: string;
  /** Default From address (e.g. "Acme <onboarding@resend.dev>"); per-message native.from wins. */
  defaultFrom?: ResendAddress;
  /** API base URL; defaults to "https://api.resend.com". */
  apiUrl?: string;
}
export type ResendNotifierConfig = Omit<ResendConfig, "type">;
