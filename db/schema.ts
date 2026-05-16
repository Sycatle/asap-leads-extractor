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
export const contactSourceEnum = pgEnum('contact_source', [
  'pappers',
  'scrape',
  'manual',
  'enrich_legal',
  'import',
]);
export const contactVerifiedStatusEnum = pgEnum('contact_verified_status', [
  'unverified',
  'valid',
  'risky',
  'bounced',
  'unsub',
]);
export const suppressionReasonEnum = pgEnum('suppression_reason', [
  'user_request',
  'bounce_hard',
  'spam_complaint',
  'manual',
  'gdpr_purge',
]);
export const consentBasisEnum = pgEnum('consent_basis', [
  'legitimate_interest',
  'opt_out_received',
]);

export const senderProviderEnum = pgEnum('sender_provider', ['resend', 'smtp']);
export const senderWarmupStatusEnum = pgEnum('sender_warmup_status', [
  'warming',
  'ready',
  'paused',
]);
export const sequenceStatusEnum = pgEnum('sequence_status', [
  'draft',
  'active',
  'paused',
  'archived',
]);
export const sequenceChannelEnum = pgEnum('sequence_channel', ['email', 'wait']);
export const enrollmentStatusEnum = pgEnum('enrollment_status', [
  'active',
  'paused',
  'finished',
  'replied',
  'unsub',
  'bounced',
  'error',
]);
export const emailEventTypeEnum = pgEnum('email_event_type', [
  'queued',
  'sent',
  'delivered',
  'open',
  'click',
  'reply',
  'bounce',
  'unsub',
  'complaint',
  'error',
]);

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

    // RGPD / CNIL
    dataSource: text('data_source'),
    gdprPurgeAt: timestamp('gdpr_purge_at', { withTimezone: true }),
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
    index('leads_gdpr_purge_idx').on(t.gdprPurgeAt),
  ],
);

// ===== OUTBOUND / RGPD =====

export const leadContacts = pgTable(
  'lead_contacts',
  {
    id: serial('id').primaryKey(),
    leadId: integer('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    role: text('role'),
    phone: text('phone'),
    linkedinUrl: text('linkedin_url'),
    source: contactSourceEnum('source').notNull().default('manual'),
    verifiedStatus: contactVerifiedStatusEnum('verified_status').notNull().default('unverified'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    collectedAt: timestamp('collected_at', { withTimezone: true }).notNull().defaultNow(),
    lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // Un email unique par lead (un même décideur peut apparaître chez plusieurs leads).
    uniqueIndex('lead_contacts_lead_email_unique').on(t.leadId, t.email),
    index('lead_contacts_email_idx').on(t.email),
    index('lead_contacts_lead_idx').on(t.leadId),
    index('lead_contacts_verified_idx').on(t.verifiedStatus),
    index('lead_contacts_deleted_idx').on(t.deletedAt),
  ],
);

// Suppression list GLOBALE — un email ici bloque tout envoi futur,
// toutes séquences confondues. RFC 8058 + CNIL.
export const suppressionList = pgTable(
  'suppression_list',
  {
    email: text('email').primaryKey(),
    reason: suppressionReasonEnum('reason').notNull(),
    source: text('source'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('suppression_created_idx').on(t.createdAt)],
);

// Trace d'intérêt légitime (preuve en cas de contrôle CNIL).
export const consentLog = pgTable(
  'consent_log',
  {
    id: serial('id').primaryKey(),
    contactId: integer('contact_id')
      .notNull()
      .references(() => leadContacts.id, { onDelete: 'cascade' }),
    basis: consentBasisEnum('basis').notNull(),
    evidence: text('evidence'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('consent_log_contact_idx').on(t.contactId),
    index('consent_log_basis_idx').on(t.basis),
  ],
);

// ===== OUTBOUND SEQUENCES =====

export const senderAccounts = pgTable(
  'sender_accounts',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    domain: text('domain').notNull(),
    displayName: text('display_name'),
    replyToTemplate: text('reply_to_template'), // ex: 'reply+{enrollmentId}@inbound.app.com'
    provider: senderProviderEnum('provider').notNull().default('resend'),
    providerConfig: jsonb('provider_config').$type<Record<string, unknown>>(),
    dailyLimit: integer('daily_limit').notNull().default(50),
    warmupStatus: senderWarmupStatusEnum('warmup_status').notNull().default('warming'),
    warmupStartedAt: timestamp('warmup_started_at', { withTimezone: true }),
    sendingWindow: jsonb('sending_window').$type<{
      startHour: number;
      endHour: number;
      timezone: string;
      weekdays: number[];
    }>(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sender_accounts_email_unique').on(t.email),
    index('sender_accounts_domain_idx').on(t.domain),
    index('sender_accounts_enabled_idx').on(t.enabled),
  ],
);

export const senderPools = pgTable(
  'sender_pools',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    accountIds: jsonb('account_ids').$type<number[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sender_pools_name_unique').on(t.name)],
);

export const templates = pgTable(
  'templates',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    subject: text('subject').notNull(),
    bodyHtml: text('body_html').notNull(),
    bodyText: text('body_text').notNull(),
    variables: jsonb('variables').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('templates_name_unique').on(t.name)],
);

export const sequences = pgTable(
  'sequences',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    status: sequenceStatusEnum('status').notNull().default('draft'),
    senderPoolId: integer('sender_pool_id').references(() => senderPools.id, {
      onDelete: 'set null',
    }),
    dailyCapPerSender: integer('daily_cap_per_sender').notNull().default(50),
    sendingWindow: jsonb('sending_window').$type<{
      startHour: number;
      endHour: number;
      timezone: string;
      weekdays: number[];
    }>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sequences_name_unique').on(t.name),
    index('sequences_status_idx').on(t.status),
  ],
);

export const sequenceSteps = pgTable(
  'sequence_steps',
  {
    id: serial('id').primaryKey(),
    sequenceId: integer('sequence_id')
      .notNull()
      .references(() => sequences.id, { onDelete: 'cascade' }),
    order: integer('order').notNull(),
    channel: sequenceChannelEnum('channel').notNull(),
    delayHours: integer('delay_hours').notNull().default(0),
    templateId: integer('template_id').references(() => templates.id, { onDelete: 'set null' }),
    condition: jsonb('condition').$type<{
      branch: 'always' | 'if_no_reply' | 'if_opened' | 'if_clicked';
    } | null>(),
  },
  (t) => [
    uniqueIndex('sequence_steps_order_unique').on(t.sequenceId, t.order),
    index('sequence_steps_sequence_idx').on(t.sequenceId),
  ],
);

export const enrollments = pgTable(
  'enrollments',
  {
    id: serial('id').primaryKey(),
    sequenceId: integer('sequence_id')
      .notNull()
      .references(() => sequences.id, { onDelete: 'cascade' }),
    contactId: integer('contact_id')
      .notNull()
      .references(() => leadContacts.id, { onDelete: 'cascade' }),
    leadId: integer('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    status: enrollmentStatusEnum('status').notNull().default('active'),
    currentStep: integer('current_step').notNull().default(0),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull().defaultNow(),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    lastSenderId: integer('last_sender_id').references(() => senderAccounts.id, {
      onDelete: 'set null',
    }),
    lastError: text('last_error'),
  },
  (t) => [
    // un contact ne peut être qu'une fois dans une séquence donnée
    uniqueIndex('enrollments_seq_contact_unique').on(t.sequenceId, t.contactId),
    index('enrollments_status_idx').on(t.status),
    index('enrollments_next_run_idx').on(t.nextRunAt),
    index('enrollments_lead_idx').on(t.leadId),
    index('enrollments_contact_idx').on(t.contactId),
    // index composite pour la requête principale du runner
    index('enrollments_runner_idx').on(t.status, t.nextRunAt),
  ],
);

export const emailEvents = pgTable(
  'email_events',
  {
    id: serial('id').primaryKey(),
    enrollmentId: integer('enrollment_id').references(() => enrollments.id, {
      onDelete: 'cascade',
    }),
    senderAccountId: integer('sender_account_id').references(() => senderAccounts.id, {
      onDelete: 'set null',
    }),
    messageId: text('message_id'),
    type: emailEventTypeEnum('type').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
  },
  (t) => [
    index('email_events_enrollment_idx').on(t.enrollmentId),
    index('email_events_sender_idx').on(t.senderAccountId),
    index('email_events_message_idx').on(t.messageId),
    index('email_events_type_idx').on(t.type),
    index('email_events_at_idx').on(t.at),
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
  contacts: many(leadContacts),
}));

export const leadContactsRelations = relations(leadContacts, ({ one, many }) => ({
  lead: one(leads, { fields: [leadContacts.leadId], references: [leads.id] }),
  consents: many(consentLog),
}));

export const consentLogRelations = relations(consentLog, ({ one }) => ({
  contact: one(leadContacts, { fields: [consentLog.contactId], references: [leadContacts.id] }),
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

export const sequencesRelations = relations(sequences, ({ one, many }) => ({
  steps: many(sequenceSteps),
  enrollments: many(enrollments),
  senderPool: one(senderPools, { fields: [sequences.senderPoolId], references: [senderPools.id] }),
}));

export const sequenceStepsRelations = relations(sequenceSteps, ({ one }) => ({
  sequence: one(sequences, { fields: [sequenceSteps.sequenceId], references: [sequences.id] }),
  template: one(templates, { fields: [sequenceSteps.templateId], references: [templates.id] }),
}));

export const enrollmentsRelations = relations(enrollments, ({ one, many }) => ({
  sequence: one(sequences, { fields: [enrollments.sequenceId], references: [sequences.id] }),
  contact: one(leadContacts, { fields: [enrollments.contactId], references: [leadContacts.id] }),
  lead: one(leads, { fields: [enrollments.leadId], references: [leads.id] }),
  lastSender: one(senderAccounts, {
    fields: [enrollments.lastSenderId],
    references: [senderAccounts.id],
  }),
  events: many(emailEvents),
}));

export const emailEventsRelations = relations(emailEvents, ({ one }) => ({
  enrollment: one(enrollments, {
    fields: [emailEvents.enrollmentId],
    references: [enrollments.id],
  }),
  senderAccount: one(senderAccounts, {
    fields: [emailEvents.senderAccountId],
    references: [senderAccounts.id],
  }),
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
export type LeadContact = typeof leadContacts.$inferSelect;
export type NewLeadContact = typeof leadContacts.$inferInsert;
export type SuppressionEntry = typeof suppressionList.$inferSelect;
export type NewSuppressionEntry = typeof suppressionList.$inferInsert;
export type ConsentLogEntry = typeof consentLog.$inferSelect;
export type NewConsentLogEntry = typeof consentLog.$inferInsert;
export type SenderAccount = typeof senderAccounts.$inferSelect;
export type NewSenderAccount = typeof senderAccounts.$inferInsert;
export type SenderPool = typeof senderPools.$inferSelect;
export type NewSenderPool = typeof senderPools.$inferInsert;
export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type Sequence = typeof sequences.$inferSelect;
export type NewSequence = typeof sequences.$inferInsert;
export type SequenceStep = typeof sequenceSteps.$inferSelect;
export type NewSequenceStep = typeof sequenceSteps.$inferInsert;
export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
export type EmailEvent = typeof emailEvents.$inferSelect;
export type NewEmailEvent = typeof emailEvents.$inferInsert;
