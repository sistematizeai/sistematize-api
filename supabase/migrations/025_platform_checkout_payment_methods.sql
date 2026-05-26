-- 025: Tokenized payment methods for the Sistematize checkout

CREATE TABLE IF NOT EXISTS platform_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  asaas_credit_card_token text NOT NULL,
  holder_name text,
  card_brand text,
  card_last4 text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_payment_methods_business
  ON platform_payment_methods(business_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_payment_methods_default
  ON platform_payment_methods(business_id)
  WHERE is_default = true;

CREATE TRIGGER trg_platform_payment_methods_updated_at
  BEFORE UPDATE ON platform_payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE platform_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_payment_methods_select ON platform_payment_methods FOR SELECT USING (
  get_user_role() IN ('master_admin', 'sub_admin')
  OR business_id = get_business_id()
);

CREATE POLICY platform_payment_methods_insert ON platform_payment_methods FOR INSERT WITH CHECK (
  get_user_role() IN ('master_admin', 'sub_admin')
  OR business_id = get_business_id()
);

CREATE POLICY platform_payment_methods_update ON platform_payment_methods FOR UPDATE USING (
  get_user_role() IN ('master_admin', 'sub_admin')
  OR business_id = get_business_id()
);
