ALTER TABLE "projects" ADD COLUMN "purpose" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;