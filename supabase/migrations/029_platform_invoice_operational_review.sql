-- 029: Operational review state for platform billing invoices

ALTER TABLE platform_invoices
  ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS operational_note text,
  ADD COLUMN IF NOT EXISTS operational_reviewed_by text,
  ADD COLUMN IF NOT EXISTS operational_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS operational_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE platform_invoices
  DROP CONSTRAINT IF EXISTS platform_invoices_operational_status_check;

ALTER TABLE platform_invoices
  ADD CONSTRAINT platform_invoices_operational_status_check
  CHECK (operational_status IN ('none', 'in_review'));

CREATE INDEX IF NOT EXISTS idx_platform_invoices_operational_status
  ON platform_invoices(operational_status, due_date DESC);
