CREATE TABLE "epic_features" (
	"epic_id" text NOT NULL,
	"feature_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_features" (
	"goal_id" text NOT NULL,
	"feature_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_epics" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"outcome" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_backlog_items" ADD COLUMN "epic_id" text;--> statement-breakpoint
ALTER TABLE "epic_features" ADD CONSTRAINT "epic_features_epic_id_product_epics_id_fk" FOREIGN KEY ("epic_id") REFERENCES "public"."product_epics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epic_features" ADD CONSTRAINT "epic_features_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_features" ADD CONSTRAINT "goal_features_goal_id_product_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."product_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_features" ADD CONSTRAINT "goal_features_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_epics" ADD CONSTRAINT "product_epics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "epic_feature_idx" ON "epic_features" USING btree ("epic_id","feature_id");--> statement-breakpoint
CREATE INDEX "epic_feature_feature_idx" ON "epic_features" USING btree ("feature_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goal_feature_idx" ON "goal_features" USING btree ("goal_id","feature_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_epics_project_slug_idx" ON "product_epics" USING btree ("project_id","slug");--> statement-breakpoint
CREATE INDEX "product_epics_project_status_idx" ON "product_epics" USING btree ("project_id","status");--> statement-breakpoint
ALTER TABLE "product_backlog_items" ADD CONSTRAINT "product_backlog_items_epic_id_product_epics_id_fk" FOREIGN KEY ("epic_id") REFERENCES "public"."product_epics"("id") ON DELETE set null ON UPDATE no action;