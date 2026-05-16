/**
 * Webhook Resend — ingère les events email (delivered, opened, clicked, bounced,
 * complained) et les insère dans `email_events`.
 *
 * Signature Svix vérifiée si `RESEND_WEBHOOK_SECRET` configuré.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  addSuppression,
  findEnrollmentById,
  getDb,
  logEmailEvent,
  terminateEnrollment,
} from '@/lib/db';
import { getResendWebhookProvider } from '../../../../../../worker/sending/registry';

interface ResendWebhookData {
  email_id?: string;
  to?: string[] | string;
  tags?: Array<{ name: string; value: string }>;
  [k: string]: unknown;
}

interface ResendWebhookPayload {
  type: string;
  data: ResendWebhookData;
}

export async function POST(request: NextRequest) {
  let payload: ResendWebhookPayload;
  let headers: Record<string, string>;

  try {
    const text = await request.text();
    payload = JSON.parse(text) as ResendWebhookPayload;
    headers = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
  } catch (err) {
    console.error('Resend webhook: invalid body', err);
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  let events;
  try {
    const provider = getResendWebhookProvider();
    events = provider.parseWebhook(payload, headers);
  } catch (err) {
    console.error('Resend webhook: signature verification failed', err);
    return NextResponse.json({ error: 'signature failed' }, { status: 401 });
  }

  if (events.length === 0) {
    return NextResponse.json({ ignored: true });
  }

  const db = getDb();

  // Récupère l'enrollment via le tag injecté côté send()
  const enrollmentTag = payload.data.tags?.find((t) => t.name === 'enrollment')?.value;
  const enrollmentId = enrollmentTag ? parseInt(enrollmentTag, 10) : null;
  const enrollment = enrollmentId ? await findEnrollmentById(db, enrollmentId) : null;

  for (const ev of events) {
    await logEmailEvent(db, {
      enrollmentId: enrollment?.id ?? null,
      senderAccountId: enrollment?.lastSenderId ?? null,
      messageId: ev.messageId,
      type: ev.type,
      meta: ev.meta,
    });

    // Actions automatiques
    if (ev.type === 'bounce' && ev.email) {
      const isHard = JSON.stringify(ev.meta?.bounce ?? {}).toLowerCase().includes('hard');
      if (isHard) {
        await addSuppression(db, {
          email: ev.email,
          reason: 'bounce_hard',
          source: 'resend_webhook',
        });
      }
      if (enrollment) {
        await terminateEnrollment(db, enrollment.id, 'bounced', 'hard bounce');
      }
    } else if (ev.type === 'complaint' && ev.email) {
      await addSuppression(db, {
        email: ev.email,
        reason: 'spam_complaint',
        source: 'resend_webhook',
      });
      if (enrollment) {
        await terminateEnrollment(db, enrollment.id, 'unsub', 'spam complaint');
      }
    } else if (ev.type === 'reply' && enrollment) {
      await terminateEnrollment(db, enrollment.id, 'replied', 'reply received');
    }
  }

  return NextResponse.json({ ingested: events.length });
}
