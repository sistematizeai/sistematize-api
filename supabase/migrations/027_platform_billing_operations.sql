-- 027: Recurring billing operations, retries and safe audit trail

ALTER TABLE platform_payment_methods
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failure_message text;

ALTER TABLE platform_payment_methods
  DROP CONSTRAINT IF EXISTS platform_payment_methods_status_check;

ALTER TABLE platform_payment_methods
  ADD CONSTRAINT platform_payment_methods_status_check
  CHECK (status IN ('active', 'disabled'));

CREATE INDEX IF NOT EXISTS idx_platform_payment_methods_active_default
  ON platform_payment_methods(business_id, is_default, created_at DESC)
  WHERE status = 'active' AND disabled_at IS NULL;

ALTER TABLE platform_invoices
  ADD COLUMN IF NOT EXISTS payment_method_id uuid REFERENCES platform_payment_methods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failure_message text;

ALTER TABLE platform_invoices
  DROP CONSTRAINT IF EXISTS platform_invoices_status_check;

ALTER TABLE platform_invoices
  ADD CONSTRAINT platform_invoices_status_check
  CHECK (status IN (
    'pending',
    'received',
    'confirmed',
    'overdue',
    'refunded',
    'deleted',
    'cancelled',
    'refused'
  ));

CREATE INDEX IF NOT EXISTS idx_platform_invoices_retry_due
  ON platform_invoices(next_retry_at, due_date)
  WHERE status IN ('pending', 'overdue') AND retry_count < 3;

CREATE TABLE IF NOT EXISTS platform_billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES platform_subscriptions(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES platform_invoices(id) ON DELETE SET NULL,
  payment_method_id uuid REFERENCES platform_payment_methods(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_billing_events
  DROP CONSTRAINT IF EXISTS platform_billing_events_severity_check;

ALTER TABLE platform_billing_events
  ADD CONSTRAINT platform_billing_events_severity_check
  CHECK (severity IN ('info', 'warn', 'error'));

CREATE INDEX IF NOT EXISTS idx_platform_billing_events_business_created
  ON platform_billing_events(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_billing_events_invoice_created
  ON platform_billing_events(invoice_id, created_at DESC);

ALTER TABLE platform_billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_billing_events_select ON platform_billing_events FOR SELECT USING (
  get_user_role() IN ('master_admin', 'sub_admin')
  OR business_id = get_business_id()
);

CREATE POLICY platform_billing_events_insert ON platform_billing_events FOR INSERT WITH CHECK (
  get_user_role() IN ('master_admin', 'sub_admin')
  OR business_id = get_business_id()
);
