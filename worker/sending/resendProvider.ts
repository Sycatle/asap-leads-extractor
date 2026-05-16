/**
 * Resend provider — implémente ISendingProvider via @resend/resend.
 *
 * Vérif signature webhook avec svix (Resend utilise Svix sous le capot).
 */

import { Resend } from 'resend';
import { Webhook } from 'svix';
import type { EmailEvent } from '../../db/schema';
import type {
  ISendingProvider,
  ParsedWebhookEvent,
  SendOptions,
  SendResult,
} from './types';

interface ResendConfig {
  apiKey: string;
  webhookSecret?: string;
}

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    to?: string[] | string;
    from?: string;
    subject?: string;
    bounce?: { message?: string };
    click?: { link?: string; ipAddress?: string; userAgent?: string };
    [k: string]: unknown;
  };
}

const RESEND_EVENT_MAP: Record<string, EmailEvent['type']> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'sent', // pas un type natif — on retombe sur sent
  'email.bounced': 'bounce',
  'email.complained': 'complaint',
  'email.opened': 'open',
  'email.clicked': 'click',
  'email.failed': 'error',
};

export class ResendProvider implements ISendingProvider {
  readonly name = 'resend' as const;
  private client: Resend;
  private webhookSecret: string | undefined;

  constructor(config: ResendConfig) {
    this.client = new Resend(config.apiKey);
    this.webhookSecret = config.webhookSecret;
  }

  async send(opts: SendOptions): Promise<SendResult> {
    const from = opts.fromName ? `${opts.fromName} <${opts.from}>` : opts.from;
    const result = await this.client.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.bodyHtml,
      text: opts.bodyText,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      ...(opts.headers ? { headers: opts.headers } : {}),
      ...(opts.tag ? { tags: [{ name: 'enrollment', value: opts.tag }] } : {}),
    });

    if (result.error) {
      throw new Error(`Resend send failed: ${result.error.message}`);
    }
    const messageId = result.data?.id;
    if (!messageId) {
      throw new Error('Resend returned no message id');
    }
    return { messageId, raw: result.data };
  }

  parseWebhook(payload: unknown, headers: Record<string, string>): ParsedWebhookEvent[] {
    // Si secret configuré, vérifier la signature Svix
    let event: ResendWebhookPayload;
    if (this.webhookSecret) {
      const wh = new Webhook(this.webhookSecret);
      const verified = wh.verify(JSON.stringify(payload), headers) as ResendWebhookPayload;
      event = verified;
    } else {
      event = payload as ResendWebhookPayload;
    }

    const mapped = RESEND_EVENT_MAP[event.type];
    if (!mapped) return [];

    const messageId = event.data.email_id;
    if (!messageId) return [];

    const to = Array.isArray(event.data.to) ? event.data.to[0] : event.data.to;
    return [
      {
        type: mapped,
        messageId,
        at: new Date(event.created_at),
        email: to,
        meta: { resendType: event.type, ...event.data },
      },
    ];
  }
}
