/**
 * Lead queries - Drizzle async port of shared/queries/leads.ts.
 *
 * Convention: toutes les fonctions sont async, prennent un `db` client en
 * premier argument (testable, multi-instance) et utilisent le query builder
 * Drizzle plutôt que du SQL brut quand c'est plus lisible.
 */

import { and, asc, desc, eq, isNull, isNotNull, like, or, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import { leads, type Lead, type NewLead } from '../schema';
import {
  type AdvancedLeadFilters,
  type LeadFilters,
  type ValidOrderColumn,
  sanitizeOrderBy,
  sanitizeOrderDir,
} from './filters';

// ===== HELPERS =====

const ORDER_BY_COLUMN_MAP = {
  created_at: leads.createdAt,
  updated_at: leads.updatedAt,
  score: leads.score,
  rating: leads.rating,
  name: leads.name,
  city: leads.city,
  next_followup_at: leads.nextFollowupAt,
  priority: leads.priority,
  status: leads.status,
  call_status: leads.callStatus,
  niche: leads.niche,
  reviews_count: leads.reviewsCount,
} as const;

function buildBasicConditions(filters: LeadFilters) {
  const conditions = [];

  if (!filters.includeDeleted) {
    conditions.push(isNull(leads.deletedAt));
  }
  if (filters.status) conditions.push(eq(leads.status, filters.status));
  if (filters.call_status) conditions.push(eq(leads.callStatus, filters.call_status));
  if (filters.city) conditions.push(like(leads.city, `%${filters.city}%`));
  if (filters.niche) conditions.push(eq(leads.niche, filters.niche));
  if (filters.priority) conditions.push(eq(leads.priority, filters.priority));
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(like(leads.name, term), like(leads.phone, term), like(leads.city, term))!,
    );
  }

  return conditions;
}

function buildAdvancedConditions(filters: AdvancedLeadFilters) {
  const conditions = buildBasicConditions({ ...filters, search: undefined });

  if (filters.search) {
    const term = `%${filters.search}%`;
    const cols = [
      leads.name, leads.phone, leads.city, leads.address,
      leads.legalName, leads.dirigeant, leads.siren, leads.siret,
      leads.niche, leads.postalCode,
    ];
    const orExpr = or(...cols.map((c) => like(c, term)));
    if (orExpr) conditions.push(orExpr);
  }

  if (filters.hasWebsite === 'yes') conditions.push(and(isNotNull(leads.website), sql`${leads.website} <> ''`)!);
  else if (filters.hasWebsite === 'no') conditions.push(or(isNull(leads.website), eq(leads.website, ''))!);

  if (filters.hasDirigeant === 'yes') conditions.push(and(isNotNull(leads.dirigeant), sql`${leads.dirigeant} <> ''`)!);
  else if (filters.hasDirigeant === 'no') conditions.push(or(isNull(leads.dirigeant), eq(leads.dirigeant, ''))!);

  if (filters.hasSiren === 'yes') conditions.push(and(isNotNull(leads.siren), sql`${leads.siren} <> ''`)!);
  else if (filters.hasSiren === 'no') conditions.push(or(isNull(leads.siren), eq(leads.siren, ''))!);

  if (filters.hasPhone === 'yes') conditions.push(and(isNotNull(leads.phone), sql`${leads.phone} <> ''`)!);
  else if (filters.hasPhone === 'no') conditions.push(or(isNull(leads.phone), eq(leads.phone, ''))!);

  if (filters.hasLegalExtracted === 'yes') conditions.push(isNotNull(leads.legalExtractedAt));
  else if (filters.hasLegalExtracted === 'no') conditions.push(isNull(leads.legalExtractedAt));

  if (filters.scoreMin !== undefined) conditions.push(sql`${leads.score} >= ${filters.scoreMin}`);
  if (filters.scoreMax !== undefined) conditions.push(sql`${leads.score} <= ${filters.scoreMax}`);
  if (filters.ratingMin !== undefined) conditions.push(sql`${leads.rating} >= ${filters.ratingMin}`);
  if (filters.ratingMax !== undefined) conditions.push(sql`${leads.rating} <= ${filters.ratingMax}`);
  if (filters.createdAfter) conditions.push(sql`${leads.createdAt} >= ${filters.createdAfter}`);
  if (filters.createdBefore) conditions.push(sql`${leads.createdAt} <= ${filters.createdBefore + ' 23:59:59'}`);

  return conditions;
}

function getOrderByExpression(filters: LeadFilters) {
  const col: ValidOrderColumn = sanitizeOrderBy(filters.orderBy);
  const dir = sanitizeOrderDir(filters.orderDir);
  const column = ORDER_BY_COLUMN_MAP[col];
  return dir === 'ASC' ? asc(column) : desc(column);
}

// ===== FIND =====

export async function findLeads(db: DbClient, filters: LeadFilters = {}): Promise<Lead[]> {
  return db
    .select()
    .from(leads)
    .where(and(...buildBasicConditions(filters)))
    .orderBy(getOrderByExpression(filters))
    .limit(filters.limit ?? 1000)
    .offset(filters.offset ?? 0);
}

export async function findLeadsAdvanced(db: DbClient, filters: AdvancedLeadFilters = {}): Promise<Lead[]> {
  return db
    .select()
    .from(leads)
    .where(and(...buildAdvancedConditions(filters)))
    .orderBy(getOrderByExpression(filters))
    .limit(filters.limit ?? 1000)
    .offset(filters.offset ?? 0);
}

export async function countLeads(db: DbClient, filters: LeadFilters = {}): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(...buildBasicConditions(filters)));
  return result[0]?.count ?? 0;
}

export async function countLeadsAdvanced(db: DbClient, filters: AdvancedLeadFilters = {}): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(...buildAdvancedConditions(filters)));
  return result[0]?.count ?? 0;
}

export async function findById(db: DbClient, id: number, includeDeleted = false): Promise<Lead | null> {
  const where = includeDeleted ? eq(leads.id, id) : and(eq(leads.id, id), isNull(leads.deletedAt));
  const result = await db.select().from(leads).where(where).limit(1);
  return result[0] ?? null;
}

export async function findByPhone(db: DbClient, phone: string): Promise<Lead | null> {
  const result = await db
    .select()
    .from(leads)
    .where(and(eq(leads.phone, phone), isNull(leads.deletedAt)))
    .limit(1);
  return result[0] ?? null;
}

export async function getExistingPhones(db: DbClient): Promise<Set<string>> {
  const rows = await db.select({ phone: leads.phone }).from(leads);
  return new Set(rows.map((r) => r.phone));
}

// ===== MUTATIONS =====

export async function insertLead(db: DbClient, lead: NewLead): Promise<Lead | null> {
  const result = await db
    .insert(leads)
    .values(lead)
    .onConflictDoUpdate({
      target: leads.phone,
      set: {
        name: lead.name,
        address: lead.address,
        city: lead.city,
        postalCode: lead.postalCode,
        website: lead.website,
        mapsUrl: lead.mapsUrl,
        rating: lead.rating,
        reviewsCount: lead.reviewsCount,
        niche: lead.niche,
        imageUrl: lead.imageUrl,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return result[0] ?? null;
}

export async function updateLead(db: DbClient, id: number, data: Partial<NewLead>): Promise<boolean> {
  const result = await db
    .update(leads)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(leads.id, id))
    .returning({ id: leads.id });
  return result.length > 0;
}

export async function updateStatus(db: DbClient, id: number, status: Lead['status']): Promise<boolean> {
  return updateLead(db, id, { status });
}

export async function scheduleFollowup(db: DbClient, id: number, date: Date | string): Promise<boolean> {
  return updateLead(db, id, { nextFollowupAt: typeof date === 'string' ? new Date(date) : date });
}

export async function softDeleteLead(db: DbClient, id: number): Promise<boolean> {
  return updateLead(db, id, { deletedAt: new Date() });
}

export async function restoreLead(db: DbClient, id: number): Promise<boolean> {
  return updateLead(db, id, { deletedAt: null });
}

export async function logCall(
  db: DbClient,
  id: number,
  callStatus: Lead['callStatus'],
): Promise<boolean> {
  return updateLead(db, id, { callStatus, lastContactAt: new Date() });
}

export async function markOptOut(db: DbClient, id: number): Promise<boolean> {
  return updateLead(db, id, { status: 'perdu', optOut: true });
}

export async function getDistinctCities(db: DbClient): Promise<string[]> {
  const rows = await db
    .selectDistinct({ city: leads.city })
    .from(leads)
    .where(isNull(leads.deletedAt))
    .orderBy(asc(leads.city));
  return rows.map((r) => r.city).filter((c): c is string => !!c);
}

export async function getDistinctNiches(db: DbClient): Promise<string[]> {
  const rows = await db
    .selectDistinct({ niche: leads.niche })
    .from(leads)
    .where(and(isNull(leads.deletedAt), isNotNull(leads.niche)));
  return rows.map((r) => r.niche).filter((n): n is string => !!n);
}
