CREATE TABLE "artifact_links" (
	"id" text PRIMARY KEY NOT NULL,
	"from_artifact_id" text NOT NULL,
	"to_artifact_id" text NOT NULL,
	"relationship" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifact_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"workstream_id" text NOT NULL,
	"session_id" text,
	"path" text NOT NULL,
	"type" text NOT NULL,
	"status" text,
	"content_hash" text NOT NULL,
	"repository_revision" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_turns" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"artifact_revision_id" text NOT NULL,
	"kind" text NOT NULL,
	"feedback" text,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"repository_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"module" text NOT NULL,
	"skill" text NOT NULL,
	"display_name" text NOT NULL,
	"phase" text NOT NULL,
	"action" text,
	"required" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"workstream_id" text NOT NULL,
	"definition_id" text,
	"skill" text NOT NULL,
	"action" text,
	"args" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prompt" text NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"provider_session_id" text,
	"raw_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workstreams" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"repository_id" text,
	"legacy_work_item_id" text,
	"title" text NOT NULL,
	"intent" text NOT NULL,
	"path" text DEFAULT 'undecided' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifact_links" ADD CONSTRAINT "artifact_links_from_artifact_id_artifact_revisions_id_fk" FOREIGN KEY ("from_artifact_id") REFERENCES "public"."artifact_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_links" ADD CONSTRAINT "artifact_links_to_artifact_id_artifact_revisions_id_fk" FOREIGN KEY ("to_artifact_id") REFERENCES "public"."artifact_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_revisions" ADD CONSTRAINT "artifact_revisions_workstream_id_workstreams_id_fk" FOREIGN KEY ("workstream_id") REFERENCES "public"."workstreams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_revisions" ADD CONSTRAINT "artifact_revisions_session_id_workflow_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workflow_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_turns" ADD CONSTRAINT "conversation_turns_session_id_workflow_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."workflow_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_artifact_revision_id_artifact_revisions_id_fk" FOREIGN KEY ("artifact_revision_id") REFERENCES "public"."artifact_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_sessions" ADD CONSTRAINT "workflow_sessions_workstream_id_workstreams_id_fk" FOREIGN KEY ("workstream_id") REFERENCES "public"."workstreams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_sessions" ADD CONSTRAINT "workflow_sessions_definition_id_workflow_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."workflow_definitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workstreams" ADD CONSTRAINT "workstreams_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workstreams" ADD CONSTRAINT "workstreams_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workstreams" ADD CONSTRAINT "workstreams_legacy_work_item_id_work_items_id_fk" FOREIGN KEY ("legacy_work_item_id") REFERENCES "public"."work_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "artifact_link_unique_idx" ON "artifact_links" USING btree ("from_artifact_id","to_artifact_id","relationship");--> statement-breakpoint
CREATE UNIQUE INDEX "artifact_revision_workstream_path_hash_idx" ON "artifact_revisions" USING btree ("workstream_id","path","content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_turn_session_sequence_idx" ON "conversation_turns" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE INDEX "review_decisions_artifact_idx" ON "review_decisions" USING btree ("artifact_revision_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_definition_install_skill_action_idx" ON "workflow_definitions" USING btree ("repository_id","fingerprint","skill","action");--> statement-breakpoint
CREATE INDEX "workflow_sessions_workstream_status_idx" ON "workflow_sessions" USING btree ("workstream_id","status");--> statement-breakpoint
CREATE INDEX "workstreams_project_status_idx" ON "workstreams" USING btree ("project_id","status");