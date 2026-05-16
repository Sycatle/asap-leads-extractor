/**
 * Notifications admin — email simple via Resend transac.
 *
 * Lit `ADMIN_NOTIFY_EMAIL` et `RESEND_API_KEY` depuis l'env. Si absent,
 * la notif est loggée mais pas envoyée (mode dev/test).
 */

import { Resend } from 'resend';
import { logger as log } from '../logger';

interface AlertOptions {
  subject: string;
  text: string;
  html?: string;
}

export async function sendAdminAlert(opts: AlertOptions): Promise<void> {
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ADMIN_NOTIFY_FROM ?? 'alerts@leadsflow.local';

  if (!to || !apiKey) {
    log.info(`[alert] (no ADMIN_NOTIFY_EMAIL or RESEND_API_KEY, not sent) ${opts.subject}`);
    log.info(opts.text);
    return;
  }

  const client = new Resend(apiKey);
  try {
    const result = await client.emails.send({
      from,
      to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html ?? `<pre>${escapeHtml(opts.text)}</pre>`,
    });
    if (result.error) throw new Error(result.error.message);
    log.info(`[alert] sent ${opts.subject} (id=${result.data?.id})`);
  } catch (err) {
    log.error(`[alert] send failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
