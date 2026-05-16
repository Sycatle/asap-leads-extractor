/**
 * Reply actions — exécute les actions automatiques selon l'intent classifié.
 *
 * Règles :
 *  - unsub_request → suppression_list + pause enrollment + consent_log(opt_out_received)
 *  - ooo → enrollment paused, nextRunAt = ooo_until ?? now+14j
 *  - wrong_person → flag note + suggestion humaine
 *  - positive | question → lead.status=qualifie + enrollment.replied + notif admin
 *  - negative → lead.status=perdu + enrollment.replied
 *  - neutral → enrollment.replied (on n'insiste pas)
 */

import { eq } from 'drizzle-orm';
import type { DbClient } from '../../db/client';
import {
  addSuppression,
  advanceEnrollment,
  findEnrollmentById,
  logConsent,
  logEmailEvent,
  markHandled,
  pauseEnrollmentsByContact,
  terminateEnrollment,
  updateLead,
} from '../../db/queries';
import { enrollments, type LeadEmail } from '../../db/schema';
import { sendAdminAlert } from '../sending/alerts';
import type { Classification } from './replyClassifier';

export interface DispatchResult {
  action: string;
  enrollmentTerminated?: boolean;
  suppressed?: boolean;
  leadStatusChanged?: string;
}

export async function dispatchReplyAction(
  db: DbClient,
  email: LeadEmail,
  classification: Classification,
): Promise<DispatchResult> {
  const result: DispatchResult = { action: classification.intent };
  const enrollment = email.enrollmentId
    ? await findEnrollmentById(db, email.enrollmentId)
    : null;

  switch (classification.intent) {
    case 'unsub_request': {
      await addSuppression(db, {
        email: email.fromEmail,
        reason: 'user_request',
        source: `reply_classifier email=${email.id}`,
      });
      if (email.contactId) {
        await pauseEnrollmentsByContact(db, email.contactId, 'unsub');
        await logConsent(db, {
          contactId: email.contactId,
          basis: 'opt_out_received',
          evidence: `reply-based unsubscribe: "${classification.summary}"`,
        });
      }
      if (enrollment) {
        await logEmailEvent(db, {
          enrollmentId: enrollment.id,
          type: 'unsub',
          meta: { from: 'reply_classifier' },
        });
      }
      result.suppressed = true;
      result.enrollmentTerminated = true;
      break;
    }
    case 'ooo': {
      if (enrollment) {
        const resumeAt = classification.ooo_until
          ? new Date(classification.ooo_until)
          : new Date(Date.now() + 14 * 24 * 3600 * 1000);
        // garde le status active mais retarde le prochain run
        await advanceEnrollment(db, enrollment.id, { nextRunAt: resumeAt });
        // marque pause logique côté status (info)
        await db
          .update(enrollments)
          .set({ status: 'paused', lastError: 'OOO until ' + resumeAt.toISOString() })
          .where(eq(enrollments.id, enrollment.id));
      }
      break;
    }
    case 'wrong_person': {
      if (enrollment) {
        await terminateEnrollment(db, enrollment.id, 'finished', 'wrong person — escalate to human');
        result.enrollmentTerminated = true;
      }
      break;
    }
    case 'positive':
    case 'question': {
      if (email.leadId) {
        await updateLead(db, email.leadId, { status: 'qualifie' });
        result.leadStatusChanged = 'qualifie';
      }
      if (enrollment) {
        await terminateEnrollment(db, enrollment.id, 'replied', classification.summary);
        result.enrollmentTerminated = true;
      }
      await sendAdminAlert({
        subject: `[leadsflow] Positive reply from ${email.fromEmail}`,
        text: `Sujet: ${email.subject ?? ''}\n\nIntent: ${classification.intent} (conf ${(classification.confidence * 100).toFixed(0)}%)\nRésumé: ${classification.summary}\nAction suggérée: ${classification.suggested_action}\n\n— ${email.fromEmail}`,
      }).catch(() => undefined);
      break;
    }
    case 'negative': {
      if (email.leadId) {
        await updateLead(db, email.leadId, { status: 'perdu' });
        result.leadStatusChanged = 'perdu';
      }
      if (enrollment) {
        await terminateEnrollment(db, enrollment.id, 'replied', 'negative reply: ' + classification.summary);
        result.enrollmentTerminated = true;
      }
      break;
    }
    case 'neutral': {
      if (enrollment) {
        await terminateEnrollment(db, enrollment.id, 'replied', 'neutral reply');
        result.enrollmentTerminated = true;
      }
      break;
    }
  }

  await markHandled(db, email.id);
  return result;
}
