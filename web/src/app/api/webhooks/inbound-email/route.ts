/**
 * Inbound email webhook — ingère les réponses entrantes (Postmark Inbound,
 * Resend Inbound, ou tout parseur compatible).
 *
 * Payload normalisé attendu (à adapter selon provider) :
 *   { from, to, subject, textBody, htmlBody, messageId, headers? }
 *
 * Le local-part de `to` peut contenir l'enrollmentId : reply+42@inbound.app.com
 *
 * Flow :
 *  1. Parse + ingest dans lead_emails (direction=inbound)
 *  2. Classifier Claude Haiku → intent + confidence
 *  3. dispatchReplyAction → suppression / pause / qualif / etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  addLeadEmail,
  findContactByEmail,
  findEnrollmentById,
  getDb,
  updateClassification,
} from '@/lib/db';
import { z } from 'zod';
import { classifyReply } from '../../../../../../worker/agents/replyClassifier';
import { dispatchReplyAction } from '../../../../../../worker/agents/replyActions';

const InboundPayloadSchema = z.object({
  from: z.string().email(),
  to: z.string(),
  subject: z.string().optional().default(''),
  textBody: z.string().optional().default(''),
  htmlBody: z.string().optional().default(''),
  messageId: z.string().optional(),
}).passthrough();

function extractEnrollmentId(to: string): number | null {
  // format reply+{id}@inbound.app.com  ou  any local-part containing +{id}
  const match = to.match(/\+(\d+)@/);
  return match ? parseInt(match[1], 10) : null;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const parsed = InboundPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid payload', issues: parsed.error.issues }, { status: 400 });
  }

  const payload = parsed.data;
  const db = getDb();
  const enrollmentId = extractEnrollmentId(payload.to);
  const enrollment = enrollmentId ? await findEnrollmentById(db, enrollmentId) : null;

  // si pas d'enrollment matché, essaie de retrouver via l'email du contact
  let contactId = enrollment?.contactId ?? null;
  let leadId = enrollment?.leadId ?? null;
  if (!contactId) {
    const candidates = await findContactByEmail(db, payload.from);
    if (candidates.length === 1) {
      contactId = candidates[0].id;
      leadId = candidates[0].leadId;
    }
  }

  const inserted = await addLeadEmail(db, {
    enrollmentId: enrollment?.id ?? null,
    contactId,
    leadId,
    direction: 'inbound',
    fromEmail: payload.from.toLowerCase(),
    toEmail: payload.to.toLowerCase(),
    subject: payload.subject,
    bodyText: payload.textBody,
    bodyHtml: payload.htmlBody,
    messageId: payload.messageId ?? null,
  });
  if (!inserted) {
    return NextResponse.json({ error: 'insert failed' }, { status: 500 });
  }

  // Classification + dispatch — best-effort, on ne fait pas échouer le webhook
  // si Anthropic est down (le message est déjà stocké).
  try {
    const classification = await classifyReply(payload.subject, payload.textBody, {
      leadId: inserted.leadId,
    });
    await updateClassification(db, inserted.id, {
      intent: classification.intent,
      classifierConfidence: Math.round(classification.confidence * 100),
      classifierSummary: classification.summary,
      classifierMeta: { suggested_action: classification.suggested_action, ooo_until: classification.ooo_until },
    });
    const refreshed = { ...inserted, intent: classification.intent };
    const action = await dispatchReplyAction(db, refreshed, classification);
    return NextResponse.json({ ingested: inserted.id, intent: classification.intent, action });
  } catch (err) {
    console.error('Inbound classifier failed:', err);
    return NextResponse.json({
      ingested: inserted.id,
      classified: false,
      warning: 'classifier failed; message stored unhandled',
    });
  }
}
