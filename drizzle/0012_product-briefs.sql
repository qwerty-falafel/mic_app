CREATE TABLE "product_briefs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"brief_id" text NOT NULL,
	"revision" integer NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"model" text NOT NULL,
	"rationale" text NOT NULL,
	"proposal" jsonb NOT NULL,
	"feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"kind" text NOT NULL,
	"feedback" text,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_briefs" ADD CONSTRAINT "product_briefs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_proposals" ADD CONSTRAINT "product_proposals_brief_id_product_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."product_briefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_decisions" ADD CONSTRAINT "proposal_decisions_proposal_id_product_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."product_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_briefs_project_idx" ON "product_briefs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_proposal_brief_revision_idx" ON "product_proposals" USING btree ("brief_id","revision");--> statement-breakpoint
CREATE INDEX "product_proposal_status_idx" ON "product_proposals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_decision_once_idx" ON "proposal_decisions" USING btree ("proposal_id");