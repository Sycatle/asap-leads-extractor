CREATE TYPE "public"."email_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."reply_intent" AS ENUM('positive', 'negative', 'neutral', 'ooo', 'wrong_person', 'unsub_request', 'question', 'unknown');--> statement-breakpoint
CREATE TABLE "lead_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"enrollment_id" integer,
	"contact_id" integer,
	"lead_id" integer,
	"direction" "email_direction" NOT NULL,
	"from_email" text NOT NULL,
	"to_email" text NOT NULL,
	"subject" text,
	"body_text" text,
	"body_html" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"message_id" text,
	"intent" "reply_intent",
	"classifier_confidence" integer,
	"classifier_summary" text,
	"classifier_meta" jsonb,
	"handled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_emails" ADD CONSTRAINT "lead_emails_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_emails" ADD CONSTRAINT "lead_emails_contact_id_lead_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."lead_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_emails" ADD CONSTRAINT "lead_emails_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_emails_enrollment_idx" ON "lead_emails" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "lead_emails_contact_idx" ON "lead_emails" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "lead_emails_lead_idx" ON "lead_emails" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_emails_direction_idx" ON "lead_emails" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "lead_emails_intent_idx" ON "lead_emails" USING btree ("intent");--> statement-breakpoint
CREATE INDEX "lead_emails_handled_idx" ON "lead_emails" USING btree ("handled");--> statement-breakpoint
CREATE INDEX "lead_emails_received_idx" ON "lead_emails" USING btree ("received_at");