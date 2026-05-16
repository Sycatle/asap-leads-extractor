CREATE TYPE "public"."consent_basis" AS ENUM('legitimate_interest', 'opt_out_received');--> statement-breakpoint
CREATE TYPE "public"."contact_source" AS ENUM('pappers', 'scrape', 'manual', 'enrich_legal', 'import');--> statement-breakpoint
CREATE TYPE "public"."contact_verified_status" AS ENUM('unverified', 'valid', 'risky', 'bounced', 'unsub');--> statement-breakpoint
CREATE TYPE "public"."suppression_reason" AS ENUM('user_request', 'bounce_hard', 'spam_complaint', 'manual', 'gdpr_purge');--> statement-breakpoint
CREATE TABLE "consent_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer NOT NULL,
	"basis" "consent_basis" NOT NULL,
	"evidence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"role" text,
	"phone" text,
	"linkedin_url" text,
	"source" "contact_source" DEFAULT 'manual' NOT NULL,
	"verified_status" "contact_verified_status" DEFAULT 'unverified' NOT NULL,
	"verified_at" timestamp with time zone,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_contacted_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "suppression_list" (
	"email" text PRIMARY KEY NOT NULL,
	"reason" "suppression_reason" NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "data_source" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "gdpr_purge_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "consent_log" ADD CONSTRAINT "consent_log_contact_id_lead_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."lead_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_contacts" ADD CONSTRAINT "lead_contacts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "consent_log_contact_idx" ON "consent_log" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "consent_log_basis_idx" ON "consent_log" USING btree ("basis");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_contacts_lead_email_unique" ON "lead_contacts" USING btree ("lead_id","email");--> statement-breakpoint
CREATE INDEX "lead_contacts_email_idx" ON "lead_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "lead_contacts_lead_idx" ON "lead_contacts" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_contacts_verified_idx" ON "lead_contacts" USING btree ("verified_status");--> statement-breakpoint
CREATE INDEX "lead_contacts_deleted_idx" ON "lead_contacts" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "suppression_created_idx" ON "suppression_list" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "leads_gdpr_purge_idx" ON "leads" USING btree ("gdpr_purge_at");