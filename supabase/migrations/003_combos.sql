-- 003_combos.sql
-- Sub-projeto 3: Combos (pacotes de servicos)

-- ============================================================
-- TABLES
-- ============================================================

-- Combos
CREATE TABLE combos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price decimal(10,2) NOT NULL DEFAULT 0,
  discount_percent decimal(5,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id, name)
);

-- Combo <-> Service (N:N)
CREATE TABLE combo_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id uuid NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE(combo_id, service_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_combos_business ON combos(business_id);
CREATE INDEX idx_combo_services_combo ON combo_services(combo_id);
CREATE INDEX idx_combo_services_service ON combo_services(service_id);

-- ============================================================
-- TRIGGERS (updated_at)
-- ============================================================

-- Reuse the update_updated_at() function from 001_initial_schema.sql
CREATE TRIGGER set_combos_updated_at BEFORE UPDATE ON combos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON combos USING (
  get_user_role() IN ('master_admin', 'sub_admin') OR business_id = get_business_id()
);
CREATE POLICY tenant_isolation ON combo_services USING (
  get_user_role() IN ('master_admin', 'sub_admin') OR combo_id IN (SELECT id FROM combos WHERE business_id = get_business_id())
);
