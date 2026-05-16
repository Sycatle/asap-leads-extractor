/**
 * API Input Validation Schemas
 * 
 * Uses Zod for runtime validation of API inputs.
 * Prevents invalid data from reaching the database.
 */

import { z } from 'zod';

// ===== LEAD STATUS ENUMS =====

export const LeadStatusSchema = z.enum([
  'nouveau',
  'contacte',
  'qualifie',
  'proposition',
  'converti',
  'perdu',
]);

export const CallStatusSchema = z.enum([
  'non_appele',
  'appele',
  'rappeler',
  'injoignable',
]);

export const EmailStatusSchema = z.enum([
  'non_envoye',
  'envoye',
  'ouvert',
  'repondu',
  'bounce',
]);

export const PrioritySchema = z.enum(['high', 'medium', 'low']);

// ===== LEAD UPDATE SCHEMAS =====

/**
 * Schema for updating a lead's basic fields
 */
export const UpdateLeadSchema = z.object({
  status: LeadStatusSchema.optional(),
  call_status: CallStatusSchema.optional(),
  email_status: EmailStatusSchema.optional(),
  priority: PrioritySchema.optional(),
  notes: z.string().max(10000).optional(),
  next_followup_at: z.string().datetime().nullable().optional(),
}).strict(); // Reject unknown fields

/**
 * Schema for updating lead status
 */
export const UpdateStatusSchema = z.object({
  status: LeadStatusSchema,
  note: z.string().max(1000).optional(),
});

/**
 * Schema for logging a call
 */
export const LogCallSchema = z.object({
  call_status: CallStatusSchema,
  note: z.string().max(1000).optional(),
  auto_schedule: z.boolean().optional(),
});

/**
 * Schema for scheduling a followup
 */
export const ScheduleFollowupSchema = z.object({
  date: z.string(),  // Can be empty string to clear followup
  note: z.string().max(1000).optional(),
});

/**
 * Schema for adding a note
 */
export const AddNoteSchema = z.object({
  note: z.string().min(1).max(10000),
});

// ===== SESSION SCHEMAS =====

/**
 * Schema for updating session stats
 */
export const UpdateSessionSchema = z.object({
  id: z.number().int().positive(),
  action: z.enum(['end', 'update']).optional(),
  stats: z.object({
    total_calls: z.number().int().min(0).optional(),
    total_reached: z.number().int().min(0).optional(),
    total_voicemail: z.number().int().min(0).optional(),
    total_scheduled: z.number().int().min(0).optional(),
  }).optional(),
});

// ===== CALL OUTCOME SCHEMAS =====

export const CallOutcomeSchema = z.enum([
  'injoignable',
  'mauvais_numero',
  'accueil',
  'decideur_absent',
  'rappeler',
  'interesse',
  'rdv_pris',
  'devis_envoye',
  'perdu',
  'opt_out',
]);

export const NextStepTypeSchema = z.enum([
  'rappel',
  'email',
  'sms',
  'rdv',
  'tache',
  'aucun',
]);

export const LostReasonSchema = z.enum([
  'pas_interesse',
  'budget',
  'timing',
  'concurrent',
  'autre',
]);

export const ProcessOutcomeSchema = z.object({
  outcome: CallOutcomeSchema,
  nextStep: z.object({
    type: NextStepTypeSchema,
    datetime: z.string().datetime().optional(),
    note: z.string().max(1000).optional(),
    templateId: z.string().optional(),
  }).optional(),
  lostReason: LostReasonSchema.optional(),
  lostNote: z.string().max(1000).optional(),
});

// ===== CONTACT / SUPPRESSION SCHEMAS =====

export const ContactSourceSchema = z.enum([
  'pappers',
  'scrape',
  'manual',
  'enrich_legal',
  'import',
]);

export const ContactVerifiedStatusSchema = z.enum([
  'unverified',
  'valid',
  'risky',
  'bounced',
  'unsub',
]);

export const SuppressionReasonSchema = z.enum([
  'user_request',
  'bounce_hard',
  'spam_complaint',
  'manual',
  'gdpr_purge',
]);

export const AddContactSchema = z.object({
  leadId: z.number().int().positive(),
  email: z.string().email().max(254),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  phone: z.string().max(40).optional(),
  linkedinUrl: z.string().url().max(500).optional(),
  source: ContactSourceSchema.default('manual'),
});

export const AddSuppressionSchema = z.object({
  email: z.string().email().max(254),
  reason: SuppressionReasonSchema.default('manual'),
  source: z.string().max(200).optional(),
});

// ===== SEQUENCES / TEMPLATES / SENDERS =====

const SendingWindowSchema = z.object({
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(1).max(24),
  timezone: z.string().min(1).max(64),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1),
});

export const SequenceChannelSchema = z.enum(['email', 'wait']);
export const SequenceStatusSchema = z.enum(['draft', 'active', 'paused', 'archived']);
export const StepConditionSchema = z.object({
  branch: z.enum(['always', 'if_no_reply', 'if_opened', 'if_clicked']),
});

export const AddTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().min(1).max(500),
  bodyHtml: z.string().min(1).max(100_000),
  bodyText: z.string().min(1).max(100_000),
  variables: z.array(z.string().max(64)).optional(),
});

export const UpdateTemplateSchema = AddTemplateSchema.partial();

export const AddSequenceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  senderPoolId: z.number().int().positive().optional(),
  dailyCapPerSender: z.number().int().min(1).max(1000).optional(),
  sendingWindow: SendingWindowSchema.optional(),
});

export const UpdateSequenceSchema = AddSequenceSchema.partial().extend({
  status: SequenceStatusSchema.optional(),
});

export const AddStepSchema = z.object({
  order: z.number().int().min(0),
  channel: SequenceChannelSchema,
  delayHours: z.number().int().min(0).max(24 * 365),
  templateId: z.number().int().positive().nullable().optional(),
  condition: StepConditionSchema.nullable().optional(),
});

export const EnrollSchema = z.object({
  contactIds: z.array(z.number().int().positive()).optional(),
  leadIds: z.array(z.number().int().positive()).optional(),
}).refine((d) => (d.contactIds && d.contactIds.length > 0) || (d.leadIds && d.leadIds.length > 0), {
  message: 'must provide contactIds or leadIds',
});

export const SenderProviderSchema = z.enum(['resend', 'smtp']);

export const AddSenderSchema = z.object({
  email: z.string().email().max(254),
  domain: z.string().min(1).max(254),
  displayName: z.string().max(200).optional(),
  replyToTemplate: z.string().max(254).optional(),
  provider: SenderProviderSchema.default('resend'),
  providerConfig: z.record(z.string(), z.unknown()).optional(),
  dailyLimit: z.number().int().min(1).max(2000).optional(),
  sendingWindow: SendingWindowSchema.optional(),
});

export const AddPoolSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  accountIds: z.array(z.number().int().positive()).default([]),
});

// ===== HELPER FUNCTIONS =====

/**
 * Validate input and return typed result or throw formatted error
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Zod 4 uses .issues
    const issues = result.error.issues || [];
    const errors = issues.map((e) => 
      `${e.path.map(String).join('.')}: ${e.message}`
    );
    throw new ValidationError(errors.join('; '));
  }
  return result.data;
}

/**
 * Custom validation error for API responses
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Helper to create error response for validation errors
 */
export function validationErrorResponse(error: unknown) {
  if (error instanceof ValidationError) {
    return {
      error: 'Validation failed',
      details: error.message,
      status: 400,
    };
  }
  return {
    error: 'Internal server error',
    status: 500,
  };
}
