export interface TwilioConfig {
  type: "twilio";
  /** Twilio Account SID (starts with AC…). */
  accountSid: string;
  /** Auth token from the Twilio console; also keys webhook signature checks. */
  authToken: string;
  /** Default sender (E.164, short code, alphanumeric sender ID, or `whatsapp:+…`). */
  from?: string;
  /** Messaging Service SID; used when `from` is absent and no native override. */
  messagingServiceSid?: string;
  /** Default status callback URL; overridable per message with native.statusCallback. */
  statusCallbackUrl?: string;
  /** REST base URL; defaults to "https://api.twilio.com". */
  apiUrl?: string;
}
export type TwilioNotifierConfig = Omit<TwilioConfig, "type">;
