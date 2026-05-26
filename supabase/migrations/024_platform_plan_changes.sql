-- 024: Pending plan changes for paid upgrades and end-of-cycle downgrades

ALTER TABLE platform_subscriptions
  ADD COLUMN IF NOT EXISTS pending_plan_id uuid REFERENCES plans(id),
  ADD COLUMN IF NOT EXISTS pending_billing_cycle text CHECK (pending_billing_cycle IN ('monthly', 'yearly')),
  ADD COLUMN IF NOT EXISTS pending_value decimal(10,2),
  ADD COLUMN IF NOT EXISTS pending_change_type text CHECK (pending_change_type IN ('upgrade', 'downgrade')),
  ADD COLUMN IF NOT EXISTS pending_effective_at date;

ALTER TABLE platform_invoices
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'subscription',
  ADD COLUMN IF NOT EXISTS pending_plan_id uuid REFERENCES plans(id),
  ADD COLUMN IF NOT EXISTS pending_billing_cycle text CHECK (pending_billing_cycle IN ('monthly', 'yearly'));

CREATE INDEX IF NOT EXISTS idx_platform_subs_pending_effective
  ON platform_subscriptions(pending_effective_at)
  WHERE pending_plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_platform_invoices_purpose
  ON platform_invoices(purpose);
