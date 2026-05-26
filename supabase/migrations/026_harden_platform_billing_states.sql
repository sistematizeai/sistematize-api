-- 026: Harden platform billing states for safer SaaS subscription lifecycle

ALTER TABLE platform_subscriptions
  DROP CONSTRAINT IF EXISTS platform_subscriptions_status_check;

ALTER TABLE platform_subscriptions
  ADD CONSTRAINT platform_subscriptions_status_check
  CHECK (status IN (
    'pending_payment',
    'active',
    'overdue',
    'past_due',
    'cancel_at_period_end',
    'cancelled',
    'expired'
  ));

CREATE INDEX IF NOT EXISTS idx_platform_invoices_payable_plan_change
  ON platform_invoices(subscription_id, pending_plan_id, pending_billing_cycle, created_at DESC)
  WHERE purpose = 'plan_change' AND status IN ('pending', 'overdue');

CREATE INDEX IF NOT EXISTS idx_platform_invoices_payable_subscription
  ON platform_invoices(subscription_id, created_at DESC)
  WHERE status IN ('pending', 'overdue');
