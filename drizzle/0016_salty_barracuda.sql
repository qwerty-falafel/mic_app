ALTER TABLE "product_backlog_items" ADD COLUMN "source_proposal_id" text;--> statement-breakpoint
ALTER TABLE "product_backlog_items" ADD COLUMN "source_artifact_id" text;--> statement-breakpoint
ALTER TABLE "product_backlog_items" ADD COLUMN "source_artifact_hash" text;--> statement-breakpoint
ALTER TABLE "product_backlog_items" ADD COLUMN "source_story_key" text;--> statement-breakpoint
ALTER TABLE "product_backlog_items" ADD COLUMN "delivery_path" text;--> statement-breakpoint
ALTER TABLE "product_backlog_items" ADD COLUMN "delivery_rationale" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_epics" ADD COLUMN "source_brief_id" text;--> statement-breakpoint
ALTER TABLE "product_epics" ADD COLUMN "source_proposal_id" text;--> statement-breakpoint
ALTER TABLE "product_epics" ADD COLUMN "delivery_path" text;--> statement-breakpoint
ALTER TABLE "product_epics" ADD COLUMN "delivery_rationale" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_sessions" ADD COLUMN "story_unit_id" text;--> statement-breakpoint
ALTER TABLE "product_backlog_items" ADD CONSTRAINT "product_backlog_items_source_proposal_id_product_proposals_id_fk" FOREIGN KEY ("source_proposal_id") REFERENCES "public"."product_proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_sessions_active_story_idx" ON "workflow_sessions" USING btree ("story_unit_id") WHERE "workflow_sessions"."story_unit_id" is not null and "workflow_sessions"."status" in ('QUEUED','RESOURCE_WAITING','RUNNING','WAITING_FOR_INPUT','BLOCKED','PAUSED','INTERRUPTED','NEEDS_CLASSIFICATION');--> statement-breakpoint
UPDATE product_epics e
SET delivery_path = w.path,
    delivery_rationale = CASE w.path
      WHEN 'direct' THEN 'Existing Delivery Case uses one bounded BMAD Build.'
      WHEN 'spec-epic' THEN 'Existing Delivery Case uses BMAD SPEC.md, Story Breakdown, and one Build per Story.'
      WHEN 'project' THEN 'Existing Delivery Case uses justified BMAD project-sized planning before per-Epic delivery.'
      ELSE delivery_rationale
    END
FROM workstreams w
WHERE e.workstream_id = w.id AND e.delivery_path IS NULL;
--> statement-breakpoint
UPDATE product_backlog_items p
SET delivery_path = w.path,
    delivery_rationale = CASE w.path
      WHEN 'direct' THEN 'Existing Delivery Case uses one bounded BMAD Build.'
      WHEN 'spec-epic' THEN 'Existing Delivery Case uses accepted BMAD planning and one Build per Story.'
      WHEN 'project' THEN 'Existing Delivery Case uses justified BMAD project-sized planning.'
      ELSE delivery_rationale
    END
FROM workstreams w
WHERE p.workstream_id = w.id AND p.delivery_path IS NULL;
