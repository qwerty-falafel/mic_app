CREATE TABLE "sprint_retrospectives" (
	"id" text PRIMARY KEY NOT NULL,
	"sprint_id" text NOT NULL,
	"insight" text NOT NULL,
	"adaptation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sprint_retrospectives_sprint_id_unique" UNIQUE("sprint_id")
);
--> statement-breakpoint
CREATE TABLE "sprint_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"sprint_id" text NOT NULL,
	"summary" text NOT NULL,
	"stakeholder_feedback" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sprint_reviews_sprint_id_unique" UNIQUE("sprint_id")
);
--> statement-breakpoint
ALTER TABLE "sprint_retrospectives" ADD CONSTRAINT "sprint_retrospectives_sprint_id_scrum_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."scrum_sprints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprint_reviews" ADD CONSTRAINT "sprint_reviews_sprint_id_scrum_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."scrum_sprints"("id") ON DELETE cascade ON UPDATE no action;