ALTER TABLE "workflow_sessions" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workstreams" ADD COLUMN "workspace_path" text;--> statement-breakpoint
ALTER TABLE "workstreams" ADD COLUMN "branch" text;--> statement-breakpoint
ALTER TABLE "workstreams" ADD COLUMN "baseline_revision" text;