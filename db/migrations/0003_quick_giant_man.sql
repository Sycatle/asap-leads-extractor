CREATE TABLE "sender_health_daily" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_account_id" integer NOT NULL,
	"date" text NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"delivered" integer DEFAULT 0 NOT NULL,
	"bounced" integer DEFAULT 0 NOT NULL,
	"complained" integer DEFAULT 0 NOT NULL,
	"opened" integer DEFAULT 0 NOT NULL,
	"clicked" integer DEFAULT 0 NOT NULL,
	"replied" integer DEFAULT 0 NOT NULL,
	"bounce_rate_bps" integer DEFAULT 0 NOT NULL,
	"complaint_rate_bps" integer DEFAULT 0 NOT NULL,
	"open_rate_bps" integer DEFAULT 0 NOT NULL,
	"reply_rate_bps" integer DEFAULT 0 NOT NULL,
	"alert_flag" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sender_health_daily" ADD CONSTRAINT "sender_health_daily_sender_account_id_sender_accounts_id_fk" FOREIGN KEY ("sender_account_id") REFERENCES "public"."sender_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sender_health_unique" ON "sender_health_daily" USING btree ("sender_account_id","date");--> statement-breakpoint
CREATE INDEX "sender_health_date_idx" ON "sender_health_daily" USING btree ("date");--> statement-breakpoint
CREATE INDEX "sender_health_alert_idx" ON "sender_health_daily" USING btree ("alert_flag");