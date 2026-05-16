/**
 * Drizzle schema - source de vérité du modèle Postgres.
 *
 * Convention :
 * - timestamps en `timestamp with time zone` (vs TEXT en SQLite)
 * - booleans en `boolean` (vs INTEGER 0/1 en SQLite)
 * - arrays/JSON en `jsonb`
 * - enums Postgres natifs pour les status fields
 *
 * Migrations gérées par drizzle-kit (pas le système de migrations.ts maison).
 */

import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ===== ENUMS =====

export const phoneTypeEnum = pgEnum('phone_type', ['pro', 'perso', 'unknown']);
export const leadSourceEnum = pgEnum('lead_source', ['gmb', 'annuaire', 'scraping', 'import', 'manual']);
export const websiteStatusEnum = pgEnum('website_status', ['none', 'old', 'platform', 'modern']);
export const priorityEnum = pgEnum('priority', ['high', 'medium', 'low']);
export const leadStatusEnum = pgEnum('lead_status', [
  'nouveau',
  'contacte',
  'qualifie',
  'proposition',
  'converti',
  'perdu',
]);
export const callStatusEnum = pgEnum('call_status', ['non_appele', 'appele', 'rappeler', 'injoignable']);
export const emailStatusEnum = pgEnum('email_status', ['non_envoye', 'envoye', 'ouvert', 'repondu', 'bounce']);
export const cmsTypeEnum = pgEnum('cms_type', [
  'wordpress', 'wix', 'shopify', 'prestashop', 'squarespace', 'webflow',
  'weebly', 'jimdo', 'blogger', 'ghost',
  'woocommerce', 'magento', 'opencart',
  'planity', 'treatwell', 'doctolib', 'kiute', 'flexy', 'wavy',
  'thefork', 'zenchef', 'eatbu', 'foxorders',
  'facebook', 'instagram', 'linktree', 'pagesjaunes',
  'googlesites',
  'custom', 'unknown',
]);

// ===== TABLES =====

export const leads = pgTable(
  'leads',
  {
    id: serial('id').primaryKey(),
    phone: text('phone').notNull(),
    phoneType: phoneTypeEnum('phone_type').notNull().default('unknown'),
    name: text('name').notNull(),
    address: text('address').notNull(),
    city: text('city').notNull(),
    postalCode: text('postal_code').notNull(),
    website: text('website'),
    websiteStatus: websiteStatusEnum('website_status'),
    mapsUrl: text('maps_url').notNull(),
    rating: doublePrecision('rating'),
    reviewsCount: integer('reviews_count'),
    niche: text('niche'),
    imageUrl: text('image_url'),
    source: leadSourceEnum('source').notNull().default('gmb'),

    // Enrichissement Pappers / Societe.com
    siren: text('siren'),
    siret: text('siret'),
    legalName: text('legal_name'),
    dirigeant: text('dirigeant'),

    // Scoring
    priority: priorityEnum('priority').notNull().default('medium'),
    score: integer('score').notNull().default(50),

    // Données GMB enrichies
    openingHours: text('opening_hours'),
    bestCallTime: text('best_call_time'),
    hasBooking: boolean('has_booking').notNull().default(false),
    hasSeo: boolean('has_seo').notNull().default(false),
    lastGmbUpdate: timestamp('last_gmb_update', { withTimezone: true }),

    // Website analysis
    cmsType: cmsTypeEnum('cms_type'),
    hasMobileFriendly: boolean('has_mobile_friendly'),
    hasSsl: boolean('has_ssl'),
    pageLoadTime: integer('page_load_time'),
    painPoints: jsonb('pain_points').$type<string[]>(),

    // Mentions-légales (agent LLM)
    legalRcs: text('legal_rcs'),
    legalCapital: text('legal_capital'),
    legalEmail: text('legal_email'),
    legalHosting: text('legal_hosting'),
    legalUrl: text('legal_url'),
    legalExtractedAt: timestamp('legal_extracted_at', { withTimezone: true }),

    // Suivi commercial
    status: leadStatusEnum('status').notNull().default('nouveau'),
    callStatus: callStatusEnum('call_status').notNull().default('non_appele'),
    emailStatus: emailStatusEnum('email_status').notNull().default('non_envoye'),
    notes: text('notes'),
    attemptsCount: integer('attempts_count').notNull().default(0),
    optOut: boolean('opt_out').notNull().default(false),

    lastContactAt: timestamp('last_contact_at', { withTimezone: true }),
    nextFollowupAt: timestamp('next_followup_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('leads_phone_unique').on(t.phone),
    index('leads_status_idx').on(t.status),
    index('leads_city_idx').on(t.city),
    index('leads_niche_idx').on(t.niche),
    index('leads_priority_idx').on(t.priority),
    index('leads_call_status_idx').on(t.callStatus),
    index('leads_score_idx').on(t.score),
    index('leads_created_at_idx').on(t.createdAt),
    index('leads_deleted_at_idx').on(t.deletedAt),
    index('leads_next_followup_idx').on(t.nextFollowupAt),
    index('leads_legal_extracted_idx').on(t.legalExtractedAt),
    // Composite indexes for soft-delete filters
    index('leads_deleted_status_idx').on(t.deletedAt, t.status),
    index('leads_deleted_city_idx').on(t.deletedAt, t.city),
    index('leads_deleted_niche_idx').on(t.deletedAt, t.niche),
    index('leads_deleted_score_idx').on(t.deletedAt, t.score),
    index('leads_deleted_next_followup_idx').on(t.deletedAt, t.nextFollowupAt),
  ],
);

export const leadPainPoints = pgTable(
  'lead_pain_points',
  {
    id: serial('id').primaryKey(),
    leadId: integer('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    painPoint: text('pain_point').notNull(),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('pain_points_lead_idx').on(t.leadId),
    index('pain_points_type_idx').on(t.painPoint),
  ],
);

export const leadCalls = pgTable(
  'lead_calls',
  {
    id: serial('id').primaryKey(),
    leadId: integer('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    sessionId: integer('session_id'),
    outcome: text('outcome').notNull(),
    durationSeconds: integer('duration_seconds'),
    note: text('note'),
    calledAt: timestamp('called_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('lead_calls_lead_idx').on(t.leadId),
    index('lead_calls_session_idx').on(t.sessionId),
    index('lead_calls_date_idx').on(t.calledAt),
    index('lead_calls_outcome_idx').on(t.outcome),
  ],
);

export const leadNotes = pgTable(
  'lead_notes',
  {
    id: serial('id').primaryKey(),
    leadId: integer('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    author: text('author').notNull().default('system'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('lead_notes_lead_idx').on(t.leadId),
    index('lead_notes_date_idx').on(t.createdAt),
  ],
);

export const leadStatusLog = pgTable(
  'lead_status_log',
  {
    id: serial('id').primaryKey(),
    leadId: integer('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    reason: text('reason'),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('status_log_lead_idx').on(t.leadId),
    index('status_log_date_idx').on(t.changedAt),
    index('status_log_to_idx').on(t.toStatus),
  ],
);

export const callSessions = pgTable('call_sessions', {
  id: serial('id').primaryKey(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  totalCalls: integer('total_calls').notNull().default(0),
  totalReached: integer('total_reached').notNull().default(0),
  totalVoicemail: integer('total_voicemail').notNull().default(0),
  totalScheduled: integer('total_scheduled').notNull().default(0),
});

export const statsDaily = pgTable(
  'stats_daily',
  {
    date: text('date').primaryKey(), // YYYY-MM-DD
    totalCalls: integer('total_calls').notNull().default(0),
    totalReached: integer('total_reached').notNull().default(0),
    totalQualified: integer('total_qualified').notNull().default(0),
    totalConverted: integer('total_converted').notNull().default(0),
    totalLost: integer('total_lost').notNull().default(0),
    newLeads: integer('new_leads').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('stats_daily_date_idx').on(t.date)],
);

// ===== SCRAPER CONFIG =====

export const scraperSettings = pgTable('scraper_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const scraperNiches = pgTable(
  'scraper_niches',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    priority: integer('priority').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('scraper_niches_name_unique').on(t.name),
    index('scraper_niches_enabled_idx').on(t.enabled),
  ],
);

export const scraperCities = pgTable(
  'scraper_cities',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    department: text('department'),
    priority: integer('priority').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('scraper_cities_name_unique').on(t.name),
    index('scraper_cities_enabled_idx').on(t.enabled),
  ],
);

export const scraperDepartments = pgTable('scraper_departments', {
  code: text('code').primaryKey(),
  name: text('name'),
  enabled: boolean('enabled').notNull().default(true),
});

export const scraperExcludeKeywords = pgTable('scraper_exclude_keywords', {
  id: serial('id').primaryKey(),
  keyword: text('keyword').notNull(),
}, (t) => [uniqueIndex('scraper_exclude_keywords_unique').on(t.keyword)]);

// ===== LLM USAGE =====

export const llmUsage = pgTable(
  'llm_usage',
  {
    id: serial('id').primaryKey(),
    provider: text('provider').notNull().default('anthropic'),
    model: text('model').notNull(),
    feature: text('feature').notNull(),
    leadId: integer('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cacheReadInputTokens: integer('cache_read_input_tokens').notNull().default(0),
    cacheCreationInputTokens: integer('cache_creation_input_tokens').notNull().default(0),
    costUsdCents: integer('cost_usd_cents').notNull().default(0),
    success: boolean('success').notNull().default(true),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('llm_usage_created_idx').on(t.createdAt),
    index('llm_usage_feature_idx').on(t.feature),
    index('llm_usage_model_idx').on(t.model),
  ],
);

// ===== RELATIONS =====

export const leadsRelations = relations(leads, ({ many }) => ({
  painPoints: many(leadPainPoints),
  calls: many(leadCalls),
  notes: many(leadNotes),
  statusLog: many(leadStatusLog),
  llmCalls: many(llmUsage),
}));

export const leadPainPointsRelations = relations(leadPainPoints, ({ one }) => ({
  lead: one(leads, { fields: [leadPainPoints.leadId], references: [leads.id] }),
}));

export const leadCallsRelations = relations(leadCalls, ({ one }) => ({
  lead: one(leads, { fields: [leadCalls.leadId], references: [leads.id] }),
  session: one(callSessions, { fields: [leadCalls.sessionId], references: [callSessions.id] }),
}));

export const leadNotesRelations = relations(leadNotes, ({ one }) => ({
  lead: one(leads, { fields: [leadNotes.leadId], references: [leads.id] }),
}));

export const leadStatusLogRelations = relations(leadStatusLog, ({ one }) => ({
  lead: one(leads, { fields: [leadStatusLog.leadId], references: [leads.id] }),
}));

export const llmUsageRelations = relations(llmUsage, ({ one }) => ({
  lead: one(leads, { fields: [llmUsage.leadId], references: [leads.id] }),
}));

// ===== TYPE EXPORTS =====
// Drizzle infère automatiquement les types ; on les ré-exporte pour usage dans le code.

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadCall = typeof leadCalls.$inferSelect;
export type NewLeadCall = typeof leadCalls.$inferInsert;
export type LeadNote = typeof leadNotes.$inferSelect;
export type NewLeadNote = typeof leadNotes.$inferInsert;
export type LlmUsageRow = typeof llmUsage.$inferSelect;
export type NewLlmUsage = typeof llmUsage.$inferInsert;
