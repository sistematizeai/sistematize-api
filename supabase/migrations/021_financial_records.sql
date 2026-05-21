-- Internal financial ledger independent from Asaas charges.
CREATE TABLE IF NOT EXISTS financial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  asaas_payment_id uuid REFERENCES asaas_payments(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  collaborator_id uuid REFERENCES collaborators(id) ON DELETE SET NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'income' CHECK (type IN ('income', 'expense')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'asaas', 'appointment')),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'pending', 'cancelled')),
  payment_method text NOT NULL CHECK (payment_method IN ('pix', 'credit', 'debit', 'cash', 'external', 'asaas')),
  amount decimal(12,2) NOT NULL CHECK (amount > 0),
  commission_percent decimal(5,2) NOT NULL DEFAULT 0,
  commission_amount decimal(12,2) NOT NULL DEFAULT 0,
  occurred_on date NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_records_business_date ON financial_records(business_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_financial_records_business_status ON financial_records(business_id, status);
CREATE INDEX IF NOT EXISTS idx_financial_records_business_payment_method ON financial_records(business_id, payment_method);
CREATE INDEX IF NOT EXISTS idx_financial_records_collaborator ON financial_records(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_financial_records_service ON financial_records(service_id);
CREATE INDEX IF NOT EXISTS idx_financial_records_client ON financial_records(client_id);
CREATE INDEX IF NOT EXISTS idx_financial_records_appointment ON financial_records(appointment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_records_asaas_payment_unique
  ON financial_records(asaas_payment_id);

DROP TRIGGER IF EXISTS set_financial_records_updated_at ON financial_records;
CREATE TRIGGER set_financial_records_updated_at
  BEFORE UPDATE ON financial_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE financial_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON financial_records;
CREATE POLICY tenant_isolation ON financial_records USING (
  business_id IN (
    SELECT business_id
    FROM profiles
    WHERE id = auth.uid()
  )
);
