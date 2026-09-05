CREATE TABLE "evidence_records" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"repository_id" text NOT NULL,
	"kind" text NOT NULL,
	"revision" text NOT NULL,
	"passed" boolean NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "evidence_run_kind_revision_idx" ON "evidence_records" USING btree ("run_id","kind","revision");