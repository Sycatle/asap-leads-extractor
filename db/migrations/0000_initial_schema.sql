CREATE TYPE "public"."call_status" AS ENUM('non_appele', 'appele', 'rappeler', 'injoignable');--> statement-breakpoint
CREATE TYPE "public"."cms_type" AS ENUM('wordpress', 'wix', 'shopify', 'prestashop', 'squarespace', 'webflow', 'weebly', 'jimdo', 'blogger', 'ghost', 'woocommerce', 'magento', 'opencart', 'planity', 'treatwell', 'doctolib', 'kiute', 'flexy', 'wavy', 'thefork', 'zenchef', 'eatbu', 'foxorders', 'facebook', 'instagram', 'linktree', 'pagesjaunes', 'googlesites', 'custom', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('non_envoye', 'envoye', 'ouvert', 'repondu', 'bounce');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('gmb', 'annuaire', 'scraping', 'import', 'manual');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('nouveau', 'contacte', 'qualifie', 'proposition', 'converti', 'perdu');--> statement-breakpoint
CREATE TYPE "public"."phone_type" AS ENUM('pro', 'perso', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."website_status" AS ENUM('none', 'old', 'platform', 'modern');--> statement-breakpoint
CREATE TABLE "call_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"total_calls" integer DEFAULT 0 NOT NULL,
	"total_reached" integer DEFAULT 0 NOT NULL,
	"total_voicemail" integer DEFAULT 0 NOT NULL,
	"total_scheduled" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"session_id" integer,
	"outcome" text NOT NULL,
	"duration_seconds" integer,
	"note" text,
	"called_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"content" text NOT NULL,
	"author" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_pain_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"pain_point" text NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_status_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"phone_type" "phone_type" DEFAULT 'unknown' NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"postal_code" text NOT NULL,
	"website" text,
	"website_status" "website_status",
	"maps_url" text NOT NULL,
	"rating" double precision,
	"reviews_count" integer,
	"niche" text,
	"image_url" text,
	"source" "lead_source" DEFAULT 'gmb' NOT NULL,
	"siren" text,
	"siret" text,
	"legal_name" text,
	"dirigeant" text,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"score" integer DEFAULT 50 NOT NULL,
	"opening_hours" text,
	"best_call_time" text,
	"has_booking" boolean DEFAULT false NOT NULL,
	"has_seo" boolean DEFAULT false NOT NULL,
	"last_gmb_update" timestamp with time zone,
	"cms_type" "cms_type",
	"has_mobile_friendly" boolean,
	"has_ssl" boolean,
	"page_load_time" integer,
	"pain_points" jsonb,
	"legal_rcs" text,
	"legal_capital" text,
	"legal_email" text,
	"legal_hosting" text,
	"legal_url" text,
	"legal_extracted_at" timestamp with time zone,
	"status" "lead_status" DEFAULT 'nouveau' NOT NULL,
	"call_status" "call_status" DEFAULT 'non_appele' NOT NULL,
	"email_status" "email_status" DEFAULT 'non_envoye' NOT NULL,
	"notes" text,
	"attempts_count" integer DEFAULT 0 NOT NULL,
	"opt_out" boolean DEFAULT false NOT NULL,
	"last_contact_at" timestamp with time zone,
	"next_followup_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "llm_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'anthropic' NOT NULL,
	"model" text NOT NULL,
	"feature" text NOT NULL,
	"lead_id" integer,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_input_tokens" integer DEFAULT 0 NOT NULL,
	"cache_creation_input_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd_cents" integer DEFAULT 0 NOT NULL,
	"success" boolean DEFAULT true NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraper_cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"department" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraper_departments" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraper_exclude_keywords" (
	"id" serial PRIMARY KEY NOT NULL,
	"keyword" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraper_niches" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraper_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stats_daily" (
	"date" text PRIMARY KEY NOT NULL,
	"total_calls" integer DEFAULT 0 NOT NULL,
	"total_reached" integer DEFAULT 0 NOT NULL,
	"total_qualified" integer DEFAULT 0 NOT NULL,
	"total_converted" integer DEFAULT 0 NOT NULL,
	"total_lost" integer DEFAULT 0 NOT NULL,
	"new_leads" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_calls" ADD CONSTRAINT "lead_calls_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_pain_points" ADD CONSTRAINT "lead_pain_points_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_status_log" ADD CONSTRAINT "lead_status_log_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "llm_usage" ADD CONSTRAINT "llm_usage_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_calls_lead_idx" ON "lead_calls" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_calls_session_idx" ON "lead_calls" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "lead_calls_date_idx" ON "lead_calls" USING btree ("called_at");--> statement-breakpoint
CREATE INDEX "lead_calls_outcome_idx" ON "lead_calls" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "lead_notes_lead_idx" ON "lead_notes" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_notes_date_idx" ON "lead_notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pain_points_lead_idx" ON "lead_pain_points" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "pain_points_type_idx" ON "lead_pain_points" USING btree ("pain_point");--> statement-breakpoint
CREATE INDEX "status_log_lead_idx" ON "lead_status_log" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "status_log_date_idx" ON "lead_status_log" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "status_log_to_idx" ON "lead_status_log" USING btree ("to_status");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_phone_unique" ON "leads" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_city_idx" ON "leads" USING btree ("city");--> statement-breakpoint
CREATE INDEX "leads_niche_idx" ON "leads" USING btree ("niche");--> statement-breakpoint
CREATE INDEX "leads_priority_idx" ON "leads" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "leads_call_status_idx" ON "leads" USING btree ("call_status");--> statement-breakpoint
CREATE INDEX "leads_score_idx" ON "leads" USING btree ("score");--> statement-breakpoint
CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "leads_deleted_at_idx" ON "leads" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "leads_next_followup_idx" ON "leads" USING btree ("next_followup_at");--> statement-breakpoint
CREATE INDEX "leads_legal_extracted_idx" ON "leads" USING btree ("legal_extracted_at");--> statement-breakpoint
CREATE INDEX "leads_deleted_status_idx" ON "leads" USING btree ("deleted_at","status");--> statement-breakpoint
CREATE INDEX "leads_deleted_city_idx" ON "leads" USING btree ("deleted_at","city");--> statement-breakpoint
CREATE INDEX "leads_deleted_niche_idx" ON "leads" USING btree ("deleted_at","niche");--> statement-breakpoint
CREATE INDEX "leads_deleted_score_idx" ON "leads" USING btree ("deleted_at","score");--> statement-breakpoint
CREATE INDEX "leads_deleted_next_followup_idx" ON "leads" USING btree ("deleted_at","next_followup_at");--> statement-breakpoint
CREATE INDEX "llm_usage_created_idx" ON "llm_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "llm_usage_feature_idx" ON "llm_usage" USING btree ("feature");--> statement-breakpoint
CREATE INDEX "llm_usage_model_idx" ON "llm_usage" USING btree ("model");--> statement-breakpoint
CREATE UNIQUE INDEX "scraper_cities_name_unique" ON "scraper_cities" USING btree ("name");--> statement-breakpoint
CREATE INDEX "scraper_cities_enabled_idx" ON "scraper_cities" USING btree ("enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "scraper_exclude_keywords_unique" ON "scraper_exclude_keywords" USING btree ("keyword");--> statement-breakpoint
CREATE UNIQUE INDEX "scraper_niches_name_unique" ON "scraper_niches" USING btree ("name");--> statement-breakpoint
CREATE INDEX "scraper_niches_enabled_idx" ON "scraper_niches" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "stats_daily_date_idx" ON "stats_daily" USING btree ("date");