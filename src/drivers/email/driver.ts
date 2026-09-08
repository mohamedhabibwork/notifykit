import { importOptional } from '../../core/dynamic-import.js';
import { NotificationConfigError, NotificationProviderError } from '../../core/errors.js';
import type { NotificationProvider } from '../../core/provider.js';
import type { NotificationMessage, NotificationResult, SendOptions } from '../../core/types.js';
import type { EmailConfig } from './config.js';
import type { EmailAddress, EmailNativeOptions, EmailRecipient, EmailResponse } from './types.js';
type Transporter = { sendMail(message: Record<string, unknown>): Promise<EmailResponse>; close?(): void };
type Nodemailer = { createTransport(options: unknown): Transporter };
const address = (input: EmailAddress): string | { address: string; name?: string } =>
  typeof input === 'string' ? input : { address: input.email, name: input.name };
const addresses = (input: EmailRecipient): unknown =>
  Array.isArray(input) ? input.map(address) : address(input as EmailAddress);
export async function createEmailProvider(
  config: EmailConfig,
): Promise<NotificationProvider<'email', EmailRecipient, EmailConfig, EmailNativeOptions, EmailResponse>> {
  let module: unknown;
  try {
    module = await importOptional('nodemailer');
  } catch (cause) {
    throw new NotificationConfigError('Email provider requires "nodemailer". Install it with: npm install nodemailer', {
      provider: 'email',
      retryable: false,
      cause,
    });
  }
  const nodemailer = ((module as { default?: Nodemailer }).default ?? module) as Nodemailer;
  const transporter = nodemailer.createTransport(config.transport);
  return {
    name: 'email',
    capabilities: { single: true, batch: false, notification: true, data: false, image: false, actions: false },
    native: () => transporter,
    async send(
      message: NotificationMessage<EmailRecipient, EmailNativeOptions>,
      _options?: SendOptions,
    ): Promise<NotificationResult<'email', EmailResponse>> {
      const native = message.native ?? {};
      const text = native.text ?? message.notification?.body;
      const html = native.html;
      if (!text && !html)
        throw new NotificationProviderError('Email notifications require a body, native.text, or native.html.', {
          provider: 'email',
          retryable: false,
        });
      try {
        const response = await transporter.sendMail({
          to: addresses(message.to),
          subject: message.notification?.title,
          text,
          html,
          from: native.from ? address(native.from) : config.defaults?.from ? address(config.defaults.from) : undefined,
          replyTo: native.replyTo && address(native.replyTo),
          cc: native.cc && addresses(native.cc),
          bcc: native.bcc && addresses(native.bcc),
          headers: native.headers,
          attachments: native.attachments,
        });
        return { ok: true, provider: 'email', messageId: response.messageId, status: 'accepted', native: response };
      } catch (cause) {
        throw new NotificationProviderError('SMTP rejected the notification.', {
          provider: 'email',
          retryable: true,
          cause,
        });
      }
    },
    close: () => transporter.close?.(),
  };
}
