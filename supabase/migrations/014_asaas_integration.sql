-- 014_asaas_integration.sql
-- Asaas payment gateway integration: connections, payments, webhook events
-- Adds payment fields to services, appointments, and clients

-- ============================================================
-- ALTER EXISTING TABLES
-- ============================================================

-- Services: payment configuration per service
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS requires_payment boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'none' CHECK (payment_type IN ('none', 'deposit', 'full_payment', 'manual')),
  ADD COLUMN IF NOT EXISTS deposit_amount decimal(10,2);

-- Appointments: payment tracking
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_required'
    CHECK (payment_status IN ('not_required', 'waiting', 'confirmed', 'received', 'overdue', 'refunded', 'cancelled', 'failed'));

-- Clients: link to Asaas customer
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS asaas_customer_id text;

-- ============================================================
-- NEW TABLES
-- ============================================================

-- Asaas connections: one per business per environment
CREATE TABLE asaas_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),

  api_key_encrypted text NOT NULL,
  api_key_last4 text NOT NULL,

  wallet_id text,
  asaas_account_id text,

  webhook_id text,
  webhook_url text,
  webhook_auth_token_encrypted text,

  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  last_tested_at timestamptz,
  disconnected_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(business_id, environment)
);

-- Asaas payments: payment records linked to appointments
CREATE TABLE asaas_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,

  asaas_payment_id text UNIQUE,
  asaas_customer_id text,

  billing_type text NOT NULL CHECK (billing_type IN ('PIX', 'BOLETO', 'CREDIT_CARD', 'UNDEFINED')),
  value decimal(10,2) NOT NULL,
  net_value decimal(10,2),
  due_date date NOT NULL,

  status text NOT NULL DEFAULT 'PENDING',

  invoice_url text,
  bank_slip_url text,
  pix_qr_code text,
  pix_payload text,

  external_reference text UNIQUE,

  raw_response jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Asaas webhook events: idempotency tracking
CREATE TABLE asaas_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,

  asaas_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  payment_id text,

  payload jsonb NOT NULL,

  processed boolean DEFAULT false,
  processed_at timestamptz,
  error_message text,

  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_asaas_connections_business ON asaas_connections(business_id);
CREATE INDEX idx_asaas_payments_business ON asaas_payments(business_id);
CREATE INDEX idx_asaas_payments_appointment ON asaas_payments(appointment_id);
CREATE INDEX idx_asaas_payments_asaas_id ON asaas_payments(asaas_payment_id);
CREATE INDEX idx_asaas_payments_external_ref ON asaas_payments(external_reference);
CREATE INDEX idx_asaas_payments_status ON asaas_payments(status);
CREATE INDEX idx_asaas_webhook_events_business ON asaas_webhook_events(business_id);
CREATE INDEX idx_asaas_webhook_events_asaas_id ON asaas_webhook_events(asaas_event_id);
CREATE INDEX idx_clients_asaas_customer ON clients(asaas_customer_id) WHERE asaas_customer_id IS NOT NULL;

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE TRIGGER set_asaas_connections_updated_at BEFORE UPDATE ON asaas_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_asaas_payments_updated_at BEFORE UPDATE ON asaas_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE asaas_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE asaas_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE asaas_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON asaas_connections USING (
  get_user_role() IN ('master_admin', 'sub_admin') OR business_id = get_business_id()
);
CREATE POLICY tenant_isolation ON asaas_payments USING (
  get_user_role() IN ('master_admin', 'sub_admin') OR business_id = get_business_id()
);
CREATE POLICY tenant_isolation ON asaas_webhook_events USING (
  get_user_role() IN ('master_admin', 'sub_admin') OR business_id = get_business_id()
);
