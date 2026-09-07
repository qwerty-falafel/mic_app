ALTER TABLE "product_epics" ADD COLUMN "workstream_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "product_epics_workstream_idx" ON "product_epics" USING btree ("workstream_id");--> statement-breakpoint
INSERT INTO product_epics (id, project_id, workstream_id, slug, name, outcome, status)
SELECT 'epic_migrated_' || substr(md5(w.id), 1, 20), w.project_id, w.id, w.slug, w.title,
       CASE WHEN w.summary <> '' THEN w.summary ELSE w.intent END, 'active'
FROM workstreams w
WHERE w.classification = 'epic'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO epic_features (epic_id, feature_id)
SELECT e.id, link.feature_id
FROM product_epics e
JOIN feature_delivery_cases link ON link.workstream_id = e.workstream_id
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO goal_features (goal_id, feature_id)
SELECT goal.id, feature.id
FROM product_goals goal
JOIN features feature ON feature.project_id = goal.project_id
WHERE goal.status = 'active' AND feature.status = 'active'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE projects
SET purpose = 'Help people comfortably listen to text of any length.'
WHERE purpose = '' AND lower(name) = 'tts application';
