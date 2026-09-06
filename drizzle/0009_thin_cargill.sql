CREATE TABLE "increments" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"sprint_id" text,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"definition_of_done" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_backlog_items" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"feature_id" text,
	"workstream_id" text,
	"story_unit_id" text,
	"kind" text DEFAULT 'story' NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"acceptance_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrum_sprints" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"number" integer NOT NULL,
	"goal" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sprint_backlog_items" (
	"sprint_id" text NOT NULL,
	"backlog_item_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "increments" ADD CONSTRAINT "increments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "increments" ADD CONSTRAINT "increments_sprint_id_scrum_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."scrum_sprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_backlog_items" ADD CONSTRAINT "product_backlog_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_backlog_items" ADD CONSTRAINT "product_backlog_items_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_backlog_items" ADD CONSTRAINT "product_backlog_items_workstream_id_workstreams_id_fk" FOREIGN KEY ("workstream_id") REFERENCES "public"."workstreams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_backlog_items" ADD CONSTRAINT "product_backlog_items_story_unit_id_story_units_id_fk" FOREIGN KEY ("story_unit_id") REFERENCES "public"."story_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrum_sprints" ADD CONSTRAINT "scrum_sprints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_backlog_items" ADD CONSTRAINT "sprint_backlog_items_sprint_id_scrum_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."scrum_sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_backlog_items" ADD CONSTRAINT "sprint_backlog_items_backlog_item_id_product_backlog_items_id_fk" FOREIGN KEY ("backlog_item_id") REFERENCES "public"."product_backlog_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "increments_project_idx" ON "increments" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "product_backlog_project_order_idx" ON "product_backlog_items" USING btree ("project_id","order");--> statement-breakpoint
CREATE UNIQUE INDEX "product_backlog_story_unit_idx" ON "product_backlog_items" USING btree ("story_unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scrum_sprint_project_number_idx" ON "scrum_sprints" USING btree ("project_id","number");--> statement-breakpoint
CREATE INDEX "scrum_sprint_project_status_idx" ON "scrum_sprints" USING btree ("project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "sprint_backlog_item_idx" ON "sprint_backlog_items" USING btree ("sprint_id","backlog_item_id");--> statement-breakpoint
CREATE INDEX "sprint_backlog_item_lookup_idx" ON "sprint_backlog_items" USING btree ("backlog_item_id");