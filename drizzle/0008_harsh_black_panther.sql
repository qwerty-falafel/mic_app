CREATE TABLE "feature_delivery_cases" (
	"feature_id" text NOT NULL,
	"workstream_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "features" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_goals" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"statement" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "definition_of_done" text DEFAULT 'The accepted outcome is integrated, usable, verified against its acceptance criteria, and supported by recorded evidence.' NOT NULL;--> statement-breakpoint
ALTER TABLE "workstreams" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "workstreams" ADD COLUMN "summary" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "workstreams" ADD COLUMN "classification" text DEFAULT 'unclassified' NOT NULL;--> statement-breakpoint
UPDATE "projects" SET "slug" = trim(both '-' from left(regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g'), 57)) || '-' || right("id", 6);--> statement-breakpoint
UPDATE "workstreams" SET "slug" = trim(both '-' from left(regexp_replace(lower("title"), '[^a-z0-9]+', '-', 'g'), 57)) || '-' || right("id", 6), "summary" = left(regexp_replace(trim("intent"), '\s+', ' ', 'g'), 240), "classification" = CASE "path" WHEN 'direct' THEN 'change' WHEN 'spec-epic' THEN 'epic' WHEN 'project' THEN 'product-initiative' WHEN 'specialist' THEN 'research' ELSE 'unclassified' END;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "workstreams" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "feature_delivery_cases" ADD CONSTRAINT "feature_delivery_cases_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_delivery_cases" ADD CONSTRAINT "feature_delivery_cases_workstream_id_workstreams_id_fk" FOREIGN KEY ("workstream_id") REFERENCES "public"."workstreams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_goals" ADD CONSTRAINT "product_goals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feature_delivery_case_idx" ON "feature_delivery_cases" USING btree ("feature_id","workstream_id");--> statement-breakpoint
CREATE INDEX "feature_delivery_workstream_idx" ON "feature_delivery_cases" USING btree ("workstream_id");--> statement-breakpoint
CREATE UNIQUE INDEX "features_project_slug_idx" ON "features" USING btree ("project_id","slug");--> statement-breakpoint
CREATE INDEX "features_project_status_idx" ON "features" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "product_goals_project_status_idx" ON "product_goals" USING btree ("project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "workstreams_project_slug_idx" ON "workstreams" USING btree ("project_id","slug");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_slug_unique" UNIQUE("slug");
