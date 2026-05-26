-- 028: Include refused invoices in operational billing retry scans

DROP INDEX IF EXISTS idx_platform_invoices_retry_due;

CREATE INDEX IF NOT EXISTS idx_platform_invoices_retry_due
  ON platform_invoices(next_retry_at, due_date)
  WHERE status IN ('pending', 'overdue', 'refused') AND retry_count < 3;
