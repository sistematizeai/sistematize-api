-- ============================================
-- 015: Platform Billing (SaaS subscriptions via Asaas)
-- ============================================

-- Add platform Asaas customer ID to businesses
ALTER TABLE businesses ADD COLUMN platform_asaas_customer_id text;

-- ============================================
-- PLATFORM SUBSCRIPTIONS
-- ============================================
CREATE TABLE platform_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id),
  asaas_subscription_id text UNIQUE NOT NULL,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  value decimal(10,2) NOT NULL,
  next_due_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'overdue', 'cancelled', 'expired')),
  started_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- PLATFORM INVOICES (each charge from subscription)
-- ============================================
CREATE TABLE platform_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES platform_subscriptions(id) ON DELETE SET NULL,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  asaas_payment_id text UNIQUE NOT NULL,
  value decimal(10,2) NOT NULL,
  net_value decimal(10,2),
  billing_type text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'received', 'overdue', 'refunded', 'deleted', 'cancelled')),
  due_date date NOT NULL,
  paid_at timestamptz,
  invoice_url text,
  bank_slip_url text,
  pix_qr_code text,
  pix_payload text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- PLATFORM WEBHOOK EVENTS (idempotency)
-- ============================================
CREATE TABLE platform_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_platform_subs_business ON platform_subscriptions(business_id);
CREATE INDEX idx_platform_subs_status ON platform_subscriptions(status);
CREATE INDEX idx_platform_invoices_business ON platform_invoices(business_id);
CREATE INDEX idx_platform_invoices_subscription ON platform_invoices(subscription_id);
CREATE INDEX idx_platform_invoices_status ON platform_invoices(status);
CREATE INDEX idx_platform_invoices_due_date ON platform_invoices(due_date);
CREATE INDEX idx_platform_webhook_events_asaas_id ON platform_webhook_events(asaas_event_id);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER trg_platform_subscriptions_updated_at
  BEFORE UPDATE ON platform_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_platform_invoices_updated_at
  BEFORE UPDATE ON platform_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE platform_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_webhook_events ENABLE ROW LEVEL SECURITY;

-- Subscriptions: owner sees own, admin sees all
CREATE POLICY platform_subs_select ON platform_subscriptions FOR SELECT USING (
  get_user_role() IN ('master_admin', 'sub_admin')
  OR business_id = get_business_id()
);
CREATE POLICY platform_subs_insert ON platform_subscriptions FOR INSERT WITH CHECK (
  get_user_role() IN ('master_admin', 'sub_admin')
);
CREATE POLICY platform_subs_update ON platform_subscriptions FOR UPDATE USING (
  get_user_role() IN ('master_admin', 'sub_admin')
);

-- Invoices: owner sees own, admin sees all
CREATE POLICY platform_invoices_select ON platform_invoices FOR SELECT USING (
  get_user_role() IN ('master_admin', 'sub_admin')
  OR business_id = get_business_id()
);
CREATE POLICY platform_invoices_insert ON platform_invoices FOR INSERT WITH CHECK (
  get_user_role() IN ('master_admin', 'sub_admin')
);
CREATE POLICY platform_invoices_update ON platform_invoices FOR UPDATE USING (
  get_user_role() IN ('master_admin', 'sub_admin')
);

-- Webhook events: insert by anyone (webhook), select by admin
CREATE POLICY platform_webhook_events_select ON platform_webhook_events FOR SELECT USING (
  get_user_role() = 'master_admin'
);
CREATE POLICY platform_webhook_events_insert ON platform_webhook_events FOR INSERT WITH CHECK (true);
