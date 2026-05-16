/**
 * Unsubscribe one-click — RFC 8058.
 *
 * GET  : page HTML "vous êtes désinscrit" (lien dans le footer).
 * POST : endpoint appelé automatiquement par Gmail/Yahoo via le header
 *        `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Doit retourner
 *        200 sans interaction utilisateur.
 *
 * Action : ajoute l'email à la suppression list, pause toutes les enrollments
 * du contact, log dans consent_log basis=opt_out_received.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  addSuppression,
  findContactById,
  getDb,
  logConsent,
  logEmailEvent,
  pauseEnrollmentsByContact,
} from '@/lib/db';
import { verifyUnsubToken } from '../../../../../../worker/sending/unsubToken';

async function processUnsubscribe(token: string) {
  const payload = verifyUnsubToken(token);
  if (!payload) return { ok: false, status: 400, message: 'invalid or expired token' };

  const db = getDb();
  const contact = await findContactById(db, payload.contactId);
  if (!contact) return { ok: false, status: 404, message: 'contact not found' };

  await addSuppression(db, {
    email: contact.email,
    reason: 'user_request',
    source: `unsub_link enrollment=${payload.enrollmentId}`,
  });
  await pauseEnrollmentsByContact(db, contact.id, 'unsub');
  await logConsent(db, {
    contactId: contact.id,
    basis: 'opt_out_received',
    evidence: `one-click unsubscribe via token, enrollment=${payload.enrollmentId}`,
  });
  await logEmailEvent(db, {
    enrollmentId: payload.enrollmentId,
    type: 'unsub',
    meta: { reason: 'user_one_click' },
  });
  return { ok: true, status: 200, email: contact.email };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await processUnsubscribe(token);
  if (!result.ok) {
    return new Response(
      `<!doctype html><html><body style="font-family:sans-serif;max-width:560px;margin:60px auto;padding:24px"><h1>Lien invalide</h1><p>${result.message}</p></body></html>`,
      { status: result.status, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }
  return new Response(
    `<!doctype html><html><body style="font-family:sans-serif;max-width:560px;margin:60px auto;padding:24px"><h1>Désinscription confirmée</h1><p>L'adresse <strong>${result.email}</strong> ne recevra plus aucun email de notre part.</p></body></html>`,
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await processUnsubscribe(token);
  return NextResponse.json({ ok: result.ok }, { status: result.status });
}
