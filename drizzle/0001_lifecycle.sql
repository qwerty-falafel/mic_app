CREATE TABLE "approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"work_item_id" text NOT NULL,
	"phase" text NOT NULL,
	"artifact_hash" text NOT NULL,
	"artifact_type" text NOT NULL,
	"repository_revision" text NOT NULL,
	"approver" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_records" (
	"id" text PRIMARY KEY NOT NULL,
	"work_item_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_records_work_item_id_unique" UNIQUE("work_item_id")
);
--> statement-breakpoint
CREATE TABLE "implementation_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"work_item_id" text NOT NULL,
	"run_id" text,
	"path" text NOT NULL,
	"content_hash" text NOT NULL,
	"baseline_revision" text NOT NULL,
	"result_revision" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planning_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"work_item_id" text NOT NULL,
	"run_id" text,
	"path" text NOT NULL,
	"content_hash" text NOT NULL,
	"baseline_revision" text NOT NULL,
	"result_revision" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technical_records" (
	"id" text PRIMARY KEY NOT NULL,
	"work_item_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "technical_records_work_item_id_unique" UNIQUE("work_item_id")
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_records" ADD CONSTRAINT "discovery_records_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "implementation_artifacts" ADD CONSTRAINT "implementation_artifacts_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "implementation_artifacts" ADD CONSTRAINT "implementation_artifacts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_artifacts" ADD CONSTRAINT "planning_artifacts_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_artifacts" ADD CONSTRAINT "planning_artifacts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technical_records" ADD CONSTRAINT "technical_records_work_item_id_work_items_id_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "approval_phase_artifact_idx" ON "approvals" USING btree ("work_item_id","phase","artifact_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "implementation_artifact_revision_idx" ON "implementation_artifacts" USING btree ("work_item_id","content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "planning_artifact_revision_idx" ON "planning_artifacts" USING btree ("work_item_id","content_hash");