import type { EmailAddress } from './types.js';
export interface EmailConfig { type: 'email'; transport: { type: 'smtp'; host: string; port: number; secure?: boolean; auth?: { user: string; pass: string } }; defaults?: { from?: EmailAddress }; }
export type EmailNotifierConfig = Omit<EmailConfig, 'type'>;
