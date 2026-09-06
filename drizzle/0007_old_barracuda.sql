CREATE TABLE "integration_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"workstream_id" text NOT NULL,
	"actor" text NOT NULL,
	"base_revision" text NOT NULL,
	"result_revision" text NOT NULL,
	"status" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_units" (
	"id" text PRIMARY KEY NOT NULL,
	"workstream_id" text NOT NULL,
	"story_key" text NOT NULL,
	"order" integer NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'backlog' NOT NULL,
	"parent_artifact_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_decisions" ADD CONSTRAINT "integration_decisions_workstream_id_workstreams_id_fk" FOREIGN KEY ("workstream_id") REFERENCES "public"."workstreams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_units" ADD CONSTRAINT "story_units_workstream_id_workstreams_id_fk" FOREIGN KEY ("workstream_id") REFERENCES "public"."workstreams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_units" ADD CONSTRAINT "story_units_parent_artifact_id_artifact_revisions_id_fk" FOREIGN KEY ("parent_artifact_id") REFERENCES "public"."artifact_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_decision_workstream_idx" ON "integration_decisions" USING btree ("workstream_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "story_unit_workstream_key_idx" ON "story_units" USING btree ("workstream_id","story_key");--> statement-breakpoint
CREATE INDEX "story_unit_workstream_order_idx" ON "story_units" USING btree ("workstream_id","order");