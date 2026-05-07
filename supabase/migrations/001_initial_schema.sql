-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE user_role AS ENUM ('master_admin', 'sub_admin', 'owner', 'collaborator');
CREATE TYPE document_type AS ENUM ('cpf', 'cnpj');
CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'paid', 'overdue', 'cancelled', 'blocked');

-- ============================================
-- TABLES
-- ============================================

-- profiles: extends auth.users
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  document text UNIQUE NOT NULL,
  document_type document_type NOT NULL,
  avatar_url text,
  phone text,
  role user_role NOT NULL DEFAULT 'owner',
  business_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  totp_secret text,
  totp_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- plans
CREATE TABLE plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_monthly decimal(10,2) NOT NULL,
  price_yearly decimal(10,2) NOT NULL,
  max_collaborators int NOT NULL DEFAULT 1,
  max_services int NOT NULL DEFAULT 10,
  max_appointments_month int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- modules
CREATE TABLE modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- plan_modules (N:N)
CREATE TABLE plan_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(plan_id, module_id)
);

-- businesses
CREATE TABLE businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  phone text,
  whatsapp text,
  address text,
  city text,
  state text,
  business_hours jsonb DEFAULT '{}',
  plan_id uuid REFERENCES plans(id),
  subscription_status subscription_status NOT NULL DEFAULT 'trial',
  trial_ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK from profiles to businesses (circular ref resolved after both exist)
ALTER TABLE profiles ADD CONSTRAINT fk_profiles_business
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;

-- user_modules (individual overrides)
CREATE TABLE user_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  granted_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, module_id, business_id)
);

-- audit_logs
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_profiles_business_id ON profiles(business_id);
CREATE INDEX idx_profiles_document ON profiles(document);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX idx_businesses_slug ON businesses(slug);
CREATE INDEX idx_businesses_plan_id ON businesses(plan_id);
CREATE INDEX idx_businesses_subscription_status ON businesses(subscription_status);
CREATE INDEX idx_plan_modules_plan_id ON plan_modules(plan_id);
CREATE INDEX idx_plan_modules_module_id ON plan_modules(module_id);
CREATE INDEX idx_user_modules_profile_id ON user_modules(profile_id);
CREATE INDEX idx_user_modules_business_id ON user_modules(business_id);
CREATE INDEX idx_audit_logs_profile_id ON audit_logs(profile_id);
CREATE INDEX idx_audit_logs_business_id ON audit_logs(business_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_businesses_updated_at
  BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_plans_updated_at
  BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS HELPER FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION public.get_business_id() RETURNS uuid AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'business_id')::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS text AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    'anonymous'
  );
$$ LANGUAGE sql STABLE;

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- profiles
CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  get_user_role() IN ('master_admin', 'sub_admin')
  OR id = auth.uid()
  OR business_id = get_business_id()
);
CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY profiles_update ON profiles FOR UPDATE USING (
  get_user_role() IN ('master_admin', 'sub_admin')
  OR id = auth.uid()
);

-- businesses
CREATE POLICY businesses_select ON businesses FOR SELECT USING (
  get_user_role() IN ('master_admin', 'sub_admin')
  OR id = get_business_id()
);
CREATE POLICY businesses_insert ON businesses FOR INSERT WITH CHECK (true);
CREATE POLICY businesses_update ON businesses FOR UPDATE USING (
  get_user_role() IN ('master_admin', 'sub_admin')
  OR id = get_business_id()
);

-- plans (readable by all authenticated, writable by admin)
CREATE POLICY plans_select ON plans FOR SELECT USING (true);
CREATE POLICY plans_insert ON plans FOR INSERT WITH CHECK (
  get_user_role() = 'master_admin'
);
CREATE POLICY plans_update ON plans FOR UPDATE USING (
  get_user_role() = 'master_admin'
);

-- modules (readable by all authenticated, writable by admin)
CREATE POLICY modules_select ON modules FOR SELECT USING (true);
CREATE POLICY modules_insert ON modules FOR INSERT WITH CHECK (
  get_user_role() = 'master_admin'
);
CREATE POLICY modules_update ON modules FOR UPDATE USING (
  get_user_role() = 'master_admin'
);

-- plan_modules
CREATE POLICY plan_modules_select ON plan_modules FOR SELECT USING (true);
CREATE POLICY plan_modules_insert ON plan_modules FOR INSERT WITH CHECK (
  get_user_role() = 'master_admin'
);
CREATE POLICY plan_modules_delete ON plan_modules FOR DELETE USING (
  get_user_role() = 'master_admin'
);

-- user_modules
CREATE POLICY user_modules_select ON user_modules FOR SELECT USING (
  get_user_role() IN ('master_admin', 'sub_admin')
  OR business_id = get_business_id()
);
CREATE POLICY user_modules_insert ON user_modules FOR INSERT WITH CHECK (
  get_user_role() = 'master_admin'
);

-- audit_logs (admin only)
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT USING (
  get_user_role() = 'master_admin'
);
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT WITH CHECK (true);

-- ============================================
-- SEED: Default plans and modules
-- ============================================
INSERT INTO plans (name, description, price_monthly, price_yearly, max_collaborators, max_services, max_appointments_month) VALUES
  ('Basico', 'Para profissionais autonomos', 49.90, 478.80, 1, 10, 100),
  ('Intermediario', 'Para saloes pequenos', 99.90, 958.80, 5, 30, 500),
  ('Completo', 'Para saloes profissionais', 199.90, 1918.80, 20, 100, 2000);

INSERT INTO modules (name, slug, description) VALUES
  ('Servicos', 'services', 'Cadastro e gestao de servicos'),
  ('Agenda', 'appointments', 'Agendamento e Kanban'),
  ('Colaboradores', 'collaborators', 'Gestao de colaboradores e comissoes'),
  ('Financeiro', 'financial', 'Controle financeiro do salao'),
  ('Pagina Publica', 'public-page', 'Pagina publica de agendamento'),
  ('WhatsApp', 'whatsapp', 'Integracao com WhatsApp via Evolution API'),
  ('Automacoes', 'automations', 'Automacoes com n8n'),
  ('Relatorios', 'reports', 'Relatorios avancados'),
  ('IA', 'ai', 'Atendimento automatizado com IA');

-- Link basic plan to basic modules
INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
WHERE p.name = 'Basico' AND m.slug IN ('services', 'appointments', 'public-page');

-- Link intermediate plan
INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
WHERE p.name = 'Intermediario' AND m.slug IN ('services', 'appointments', 'collaborators', 'financial', 'public-page', 'whatsapp');

-- Link complete plan (all modules)
INSERT INTO plan_modules (plan_id, module_id)
SELECT p.id, m.id FROM plans p, modules m
WHERE p.name = 'Completo';
