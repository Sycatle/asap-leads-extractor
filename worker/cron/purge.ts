/**
 * RGPD purge — supprime les contacts dont le dernier contact actif date de
 * plus de 3 ans (recommandation CNIL : durée de conservation max après
 * dernier échange).
 *
 * Sont éligibles : contacts dont `last_contacted_at` (ou `collected_at` si jamais
 * contactés) dépasse `now() - interval '3 years'`.
 *
 * Action :
 *  - soft-delete (deleted_at = now())
 *  - ajout dans `suppression_list` raison `gdpr_purge` (évite réenrichissement)
 *
 * Dry-run par défaut. Passer `{ apply: true }` pour appliquer.
 */

import { and, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { DbClient } from '../../db/client';
import { addSuppression } from '../../db/queries/suppression';
import { leadContacts } from '../../db/schema';
import { logger as log } from '../logger';

export interface PurgeOptions {
  apply?: boolean;
  retentionYears?: number;
}

export interface PurgeResult {
  candidates: number;
  purged: number;
  suppressed: number;
  dryRun: boolean;
}

export async function runPurge(db: DbClient, opts: PurgeOptions = {}): Promise<PurgeResult> {
  const apply = opts.apply ?? false;
  const years = opts.retentionYears ?? 3;
  const cutoff = sql`now() - make_interval(years => ${years})`;

  // Sélection : pas déjà supprimé ET (last_contacted_at < cutoff OU jamais contacté + collected_at < cutoff)
  const rows = await db
    .select({ id: leadContacts.id, email: leadContacts.email })
    .from(leadContacts)
    .where(
      and(
        isNull(leadContacts.deletedAt),
        or(
          lte(leadContacts.lastContactedAt, cutoff),
          and(isNull(leadContacts.lastContactedAt), lte(leadContacts.collectedAt, cutoff)),
        ),
      ),
    );

  if (rows.length === 0) {
    log.info('[purge] aucun contact éligible à la purge RGPD');
    return { candidates: 0, purged: 0, suppressed: 0, dryRun: !apply };
  }

  log.info(`[purge] ${rows.length} contact(s) éligible(s)${apply ? ' — application' : ' — dry-run'}`);

  if (!apply) {
    for (const r of rows.slice(0, 10)) log.info(`  → ${r.email}`);
    if (rows.length > 10) log.info(`  … (+${rows.length - 10})`);
    return { candidates: rows.length, purged: 0, suppressed: 0, dryRun: true };
  }

  let suppressed = 0;
  for (const r of rows) {
    const added = await addSuppression(db, {
      email: r.email,
      reason: 'gdpr_purge',
      source: 'cron/purge',
    });
    if (added) suppressed += 1;
  }

  const ids = rows.map((r) => r.id);
  const updated = await db
    .update(leadContacts)
    .set({ deletedAt: new Date() })
    .where(inArray(leadContacts.id, ids))
    .returning({ id: leadContacts.id });

  log.success(`[purge] ${updated.length} contact(s) purgé(s), ${suppressed} ajouté(s) à la suppression list`);
  return { candidates: rows.length, purged: updated.length, suppressed, dryRun: false };
}
