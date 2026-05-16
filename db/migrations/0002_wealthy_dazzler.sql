CREATE TYPE "public"."email_event_type" AS ENUM('queued', 'sent', 'delivered', 'open', 'click', 'reply', 'bounce', 'unsub', 'complaint', 'error');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'paused', 'finished', 'replied', 'unsub', 'bounced', 'error');--> statement-breakpoint
CREATE TYPE "public"."sender_provider" AS ENUM('resend', 'smtp');--> statement-breakpoint
CREATE TYPE "public"."sender_warmup_status" AS ENUM('warming', 'ready', 'paused');--> statement-breakpoint
CREATE TYPE "public"."sequence_channel" AS ENUM('email', 'wait');--> statement-breakpoint
CREATE TYPE "public"."sequence_status" AS ENUM('draft', 'active', 'paused', 'archived');--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"enrollment_id" integer,
	"sender_account_id" integer,
	"message_id" text,
	"type" "email_event_type" NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"sequence_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"lead_id" integer NOT NULL,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"next_run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"last_sender_id" integer,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "sender_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"domain" text NOT NULL,
	"display_name" text,
	"reply_to_template" text,
	"provider" "sender_provider" DEFAULT 'resend' NOT NULL,
	"provider_config" jsonb,
	"daily_limit" integer DEFAULT 50 NOT NULL,
	"warmup_status" "sender_warmup_status" DEFAULT 'warming' NOT NULL,
	"warmup_started_at" timestamp with time zone,
	"sending_window" jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sender_pools" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"account_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sequence_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"sequence_id" integer NOT NULL,
	"order" integer NOT NULL,
	"channel" "sequence_channel" NOT NULL,
	"delay_hours" integer DEFAULT 0 NOT NULL,
	"template_id" integer,
	"condition" jsonb
);
--> statement-breakpoint
CREATE TABLE "sequences" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "sequence_status" DEFAULT 'draft' NOT NULL,
	"sender_pool_id" integer,
	"daily_cap_per_sender" integer DEFAULT 50 NOT NULL,
	"sending_window" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"body_text" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_sender_account_id_sender_accounts_id_fk" FOREIGN KEY ("sender_account_id") REFERENCES "public"."sender_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_contact_id_lead_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."lead_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_last_sender_id_sender_accounts_id_fk" FOREIGN KEY ("last_sender_id") REFERENCES "public"."sender_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_sequence_id_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."sequences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_sender_pool_id_sender_pools_id_fk" FOREIGN KEY ("sender_pool_id") REFERENCES "public"."sender_pools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_events_enrollment_idx" ON "email_events" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "email_events_sender_idx" ON "email_events" USING btree ("sender_account_id");--> statement-breakpoint
CREATE INDEX "email_events_message_idx" ON "email_events" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "email_events_type_idx" ON "email_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "email_events_at_idx" ON "email_events" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_seq_contact_unique" ON "enrollments" USING btree ("sequence_id","contact_id");--> statement-breakpoint
CREATE INDEX "enrollments_status_idx" ON "enrollments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "enrollments_next_run_idx" ON "enrollments" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "enrollments_lead_idx" ON "enrollments" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "enrollments_contact_idx" ON "enrollments" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "enrollments_runner_idx" ON "enrollments" USING btree ("status","next_run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sender_accounts_email_unique" ON "sender_accounts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "sender_accounts_domain_idx" ON "sender_accounts" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "sender_accounts_enabled_idx" ON "sender_accounts" USING btree ("enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "sender_pools_name_unique" ON "sender_pools" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "sequence_steps_order_unique" ON "sequence_steps" USING btree ("sequence_id","order");--> statement-breakpoint
CREATE INDEX "sequence_steps_sequence_idx" ON "sequence_steps" USING btree ("sequence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sequences_name_unique" ON "sequences" USING btree ("name");--> statement-breakpoint
CREATE INDEX "sequences_status_idx" ON "sequences" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "templates_name_unique" ON "templates" USING btree ("name");