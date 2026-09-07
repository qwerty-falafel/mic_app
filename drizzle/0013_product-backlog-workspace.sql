ALTER TABLE "product_backlog_items" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "product_backlog_items" ADD COLUMN "value" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_backlog_items" ADD COLUMN "acceptance_signal" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_backlog_items" ADD COLUMN "dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
WITH numbered AS (SELECT id, row_number() OVER (ORDER BY created_at, id) AS number FROM product_backlog_items)
UPDATE product_backlog_items AS item SET reference = 'PBI-' || numbered.number, value = CASE WHEN item.value = '' THEN item.description ELSE item.value END FROM numbered WHERE item.id = numbered.id;--> statement-breakpoint
UPDATE product_backlog_items SET kind = 'discovery' WHERE kind = 'research';--> statement-breakpoint
UPDATE product_backlog_items SET status = 'needs-classification' WHERE kind IN ('epic', 'change', 'correction');--> statement-breakpoint
CREATE UNIQUE INDEX "product_backlog_reference_idx" ON "product_backlog_items" USING btree ("reference");