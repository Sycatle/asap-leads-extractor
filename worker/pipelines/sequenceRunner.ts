/**
 * Sequence runner — tick-based pipeline d'envoi de séquences outbound.
 *
 * Flow par tick :
 *  1. SELECT enrollments active where next_run_at <= now() LIMIT N
 *  2. Pour chaque enrollment :
 *     a. Charger contact + lead + sender_pool + step courant
 *     b. Vérifier suppression list (sinon → status unsub, log event)
 *     c. Évaluer condition du step (if_no_reply, if_opened, etc.)
 *     d. Si channel=wait → avance directement
 *     e. Si channel=email → render template + injecter footer + send via provider
 *     f. Log email_event + avance enrollment
 *  3. Termine quand plus de step (status finished).
 *
 * Sécurités :
 *  - isSuppressed bloque même si le contact a été enrollé par erreur
 *  - markContacted met à jour lastContactedAt du contact pour la purge RGPD
 *  - logConsent enregistre l'évidence de l'envoi (defense in depth CNIL)
 */

import { eq } from 'drizzle-orm';
import type { DbClient } from '../../db/client';
import {
  advanceEnrollment,
  deferEnrollment,
  findSequenceById,
  findStepByOrder,
  findTemplateById,
  hasEvent,
  isSuppressed,
  listDueEnrollments,
  logConsent,
  logEmailEvent,
  markContacted,
  selectSenderForEnrollment,
  terminateEnrollment,
} from '../../db/queries';
import {
  leads,
  leadContacts,
  type Enrollment,
  type Lead,
  type LeadContact,
  type SenderAccount,
  type Sequence,
  type SequenceStep,
  type Template,
} from '../../db/schema';
import { logger as log } from '../logger';
import { appendFooter, buildUnsubHeaders, type FooterContext } from '../sending/footer';
import { getProvider } from '../sending/registry';
import { renderTemplate, type RenderContext } from '../sending/render';
import { signUnsubToken } from '../sending/unsubToken';

export interface RunnerOptions {
  batchSize?: number;
  appDomain?: string;
  privacyUrl?: string;
}

export interface RunnerStats {
  picked: number;
  sent: number;
  suppressed: number;
  finished: number;
  errors: number;
  skipped: number;
}

export async function runSequenceTick(
  db: DbClient,
  opts: RunnerOptions = {},
): Promise<RunnerStats> {
  const stats: RunnerStats = { picked: 0, sent: 0, suppressed: 0, finished: 0, errors: 0, skipped: 0 };
  const due = await listDueEnrollments(db, opts.batchSize ?? 100);
  stats.picked = due.length;
  if (due.length === 0) return stats;

  log.info(`[runner] ${due.length} enrollment(s) due`);

  for (const enrollment of due) {
    try {
      const outcome = await processEnrollment(db, enrollment, opts);
      stats[outcome] += 1;
    } catch (err) {
      stats.errors += 1;
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`[runner] enrollment ${enrollment.id} failed: ${msg}`);
      await logEmailEvent(db, {
        enrollmentId: enrollment.id,
        type: 'error',
        meta: { error: msg },
      });
      await terminateEnrollment(db, enrollment.id, 'error', msg);
    }
  }

  log.info(
    `[runner] tick done: sent=${stats.sent} suppressed=${stats.suppressed} finished=${stats.finished} skipped=${stats.skipped} errors=${stats.errors}`,
  );
  return stats;
}

type Outcome = 'sent' | 'suppressed' | 'finished' | 'skipped';

async function processEnrollment(
  db: DbClient,
  enrollment: Enrollment,
  opts: RunnerOptions,
): Promise<Outcome> {
  const sequence = await findSequenceById(db, enrollment.sequenceId);
  if (!sequence || sequence.status !== 'active') {
    await terminateEnrollment(db, enrollment.id, 'paused', `sequence ${sequence?.status ?? 'missing'}`);
    return 'skipped';
  }

  const step = await findStepByOrder(db, enrollment.sequenceId, enrollment.currentStep);
  if (!step) {
    await terminateEnrollment(db, enrollment.id, 'finished');
    return 'finished';
  }

  // Évalue la condition du step (branchements)
  if (step.condition && step.condition.branch !== 'always') {
    const passes = await evaluateBranch(db, enrollment.id, step.condition.branch);
    if (!passes) {
      // skip this step
      await advanceToNextStep(db, enrollment.id, enrollment.currentStep, 0);
      return 'skipped';
    }
  }

  if (step.channel === 'wait') {
    await advanceToNextStep(db, enrollment.id, enrollment.currentStep, step.delayHours);
    return 'skipped';
  }

  // channel === 'email'
  const contact = await fetchContact(db, enrollment.contactId);
  const lead = await fetchLead(db, enrollment.leadId);
  if (!contact || !lead) {
    await terminateEnrollment(db, enrollment.id, 'error', 'contact or lead missing');
    return 'skipped';
  }

  if (await isSuppressed(db, contact.email)) {
    await logEmailEvent(db, { enrollmentId: enrollment.id, type: 'unsub', meta: { reason: 'in_suppression_list' } });
    await terminateEnrollment(db, enrollment.id, 'unsub', 'suppression_list');
    return 'suppressed';
  }

  if (!sequence.senderPoolId) {
    throw new Error(`sequence ${sequence.id} has no sender pool`);
  }

  const sender = await selectSenderForEnrollment(db, sequence.senderPoolId);
  if (!sender) {
    log.info(`[runner] no eligible sender for enrollment ${enrollment.id}, defer 1h`);
    await defer(db, enrollment.id, 60);
    return 'skipped';
  }

  if (!step.templateId) {
    throw new Error(`step ${step.id} (email) has no template`);
  }
  const template = await findTemplateById(db, step.templateId);
  if (!template) throw new Error(`template ${step.templateId} not found`);

  await sendStep({ db, opts, sequence, step, enrollment, contact, lead, sender, template });
  return 'sent';
}

async function evaluateBranch(
  db: DbClient,
  enrollmentId: number,
  branch: 'if_no_reply' | 'if_opened' | 'if_clicked',
): Promise<boolean> {
  if (branch === 'if_no_reply') return !(await hasEvent(db, enrollmentId, 'reply'));
  if (branch === 'if_opened') return hasEvent(db, enrollmentId, 'open');
  if (branch === 'if_clicked') return hasEvent(db, enrollmentId, 'click');
  return true;
}

async function advanceToNextStep(
  db: DbClient,
  enrollmentId: number,
  currentStep: number,
  delayHours: number,
): Promise<void> {
  const nextRunAt = new Date(Date.now() + delayHours * 3600 * 1000);
  await advanceEnrollment(db, enrollmentId, {
    currentStep: currentStep + 1,
    nextRunAt,
  });
}

async function defer(db: DbClient, enrollmentId: number, minutes: number): Promise<void> {
  const nextRunAt = new Date(Date.now() + minutes * 60 * 1000);
  await deferEnrollment(db, enrollmentId, nextRunAt);
}

async function fetchContact(db: DbClient, contactId: number): Promise<LeadContact | null> {
  const rows = await db.select().from(leadContacts).where(eq(leadContacts.id, contactId)).limit(1);
  return rows[0] ?? null;
}

async function fetchLead(db: DbClient, leadId: number): Promise<Lead | null> {
  const rows = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  return rows[0] ?? null;
}

async function sendStep(args: {
  db: DbClient;
  opts: RunnerOptions;
  sequence: Sequence;
  step: SequenceStep;
  enrollment: Enrollment;
  contact: LeadContact;
  lead: Lead;
  sender: SenderAccount;
  template: Template;
}): Promise<void> {
  const { db, opts, sequence, step, enrollment, contact, lead, sender, template } = args;
  const appDomain = opts.appDomain ?? process.env.APP_DOMAIN ?? 'localhost:3000';
  const privacyUrl = opts.privacyUrl ?? `https://${appDomain}/privacy`;

  const unsubToken = signUnsubToken({ enrollmentId: enrollment.id, contactId: contact.id });
  const unsubUrl = `https://${appDomain}/api/u/${unsubToken}`;

  const ctx: RenderContext = {
    firstName: contact.firstName ?? '',
    lastName: contact.lastName ?? '',
    fullName: [contact.firstName, contact.lastName].filter(Boolean).join(' '),
    role: contact.role ?? '',
    email: contact.email,
    companyName: lead.legalName ?? lead.name,
    city: lead.city,
    niche: lead.niche ?? '',
    siren: lead.siren ?? '',
    rcs: lead.legalRcs ?? '',
    capital: lead.legalCapital ?? '',
    website: lead.website ?? '',
    senderName: sender.displayName ?? '',
    unsubUrl,
  };

  const subject = renderTemplate(template.subject, ctx);
  const bodyHtmlRaw = renderTemplate(template.bodyHtml, ctx);
  const bodyTextRaw = renderTemplate(template.bodyText, ctx);

  const footerCtx: FooterContext = {
    senderName: sender.displayName ?? sender.email,
    senderCompany: sender.domain,
    dataSource: lead.dataSource ?? lead.source,
    privacyUrl,
    unsubUrl,
  };
  const { html, text } = appendFooter({ html: bodyHtmlRaw, text: bodyTextRaw }, footerCtx);

  const replyTo = sender.replyToTemplate
    ? sender.replyToTemplate.replace('{enrollmentId}', String(enrollment.id))
    : null;

  const provider = getProvider(sender);
  const result = await provider.send({
    from: sender.email,
    fromName: sender.displayName,
    to: contact.email,
    subject,
    bodyHtml: html,
    bodyText: text,
    replyTo,
    headers: buildUnsubHeaders(unsubUrl),
    tag: String(enrollment.id),
  });

  await logEmailEvent(db, {
    enrollmentId: enrollment.id,
    senderAccountId: sender.id,
    messageId: result.messageId,
    type: 'sent',
    meta: { stepId: step.id, sequenceId: sequence.id },
  });

  await markContacted(db, contact.id);
  await logConsent(db, {
    contactId: contact.id,
    basis: 'legitimate_interest',
    evidence: `sequence=${sequence.id} step=${step.id} sender=${sender.email} msg=${result.messageId}`,
  });

  await advanceEnrollment(db, enrollment.id, {
    currentStep: enrollment.currentStep + 1,
    nextRunAt: new Date(Date.now() + step.delayHours * 3600 * 1000),
    lastSenderId: sender.id,
  });
}
