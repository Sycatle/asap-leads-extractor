/**
 * Interface unifiée pour les providers d'envoi email.
 *
 * Implémentations actuelles : Resend. À venir : SMTP générique, Smartlead.
 */

import type { EmailEvent, SenderAccount } from '../../db/schema';

export interface SendOptions {
  from: string;
  fromName?: string | null;
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  replyTo?: string | null;
  /** Headers spécifiques (List-Unsubscribe, List-Unsubscribe-Post, …) */
  headers?: Record<string, string>;
  /** Tag interne pour corrélation event ↔ enrollment */
  tag?: string;
}

export interface SendResult {
  messageId: string;
  raw?: unknown;
}

export interface ParsedWebhookEvent {
  type: EmailEvent['type'];
  messageId: string;
  at: Date;
  meta?: Record<string, unknown>;
  /** Présent si on récupère l'adresse depuis le payload (bounce/complaint) */
  email?: string;
}

export interface ISendingProvider {
  readonly name: SenderAccount['provider'];
  send(opts: SendOptions): Promise<SendResult>;
  parseWebhook(payload: unknown, signatureHeaders: Record<string, string>): ParsedWebhookEvent[];
}
