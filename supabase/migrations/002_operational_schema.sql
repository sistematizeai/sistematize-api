-- 002_operational_schema.sql
-- Sub-projeto 2: Categories, Services, Collaborators, Clients, Appointments

-- ============================================================
-- TABLES
-- ============================================================

-- Categories
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#7c3aed',
  icon text,
  description text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id, name)
);

-- Services
CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price decimal(10,2) NOT NULL DEFAULT 0,
  price_type text NOT NULL DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'starting_at', 'on_request')),
  duration_minutes int NOT NULL DEFAULT 30,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id, category_id, name)
);

-- Collaborators
CREATE TABLE collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  email text,
  cpf text,
  birth_date date,
  address text,
  avatar_url text,
  base_commission decimal(5,2) NOT NULL DEFAULT 0,
  work_start time NOT NULL DEFAULT '08:00',
  work_end time NOT NULL DEFAULT '18:00',
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Collaborator <-> Service (N:N with individual commission)
CREATE TABLE collaborator_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  collaborator_id uuid NOT NULL REFERENCES collaborators(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  commission decimal(5,2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(collaborator_id, service_id)
);

-- Clients
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  birth_date date,
  source text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Partial unique indexes for clients (phone/email unique per business when not null)
CREATE UNIQUE INDEX idx_clients_business_phone ON clients(business_id, phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX idx_clients_business_email ON clients(business_id, email) WHERE email IS NOT NULL;

-- Appointments
CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  collaborator_id uuid NOT NULL REFERENCES collaborators(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  total_price decimal(10,2) NOT NULL DEFAULT 0,
  total_duration int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  payment_method text CHECK (payment_method IN ('pix', 'credit', 'debit', 'cash') OR payment_method IS NULL),
  notes text,
  source text NOT NULL DEFAULT 'dashboard' CHECK (source IN ('dashboard', 'public_page', 'whatsapp')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Appointment <-> Service (N:N with price/duration snapshot)
CREATE TABLE appointment_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  price decimal(10,2) NOT NULL,
  duration_minutes int NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_categories_business ON categories(business_id);
CREATE INDEX idx_services_business ON services(business_id);
CREATE INDEX idx_services_category ON services(category_id);
CREATE INDEX idx_collaborators_business ON collaborators(business_id);
CREATE INDEX idx_collaborators_profile ON collaborators(profile_id);
CREATE INDEX idx_collaborator_services_collaborator ON collaborator_services(collaborator_id);
CREATE INDEX idx_collaborator_services_service ON collaborator_services(service_id);
CREATE INDEX idx_collaborator_services_business ON collaborator_services(business_id);
CREATE INDEX idx_clients_business ON clients(business_id);
CREATE INDEX idx_appointments_business ON appointments(business_id);
CREATE INDEX idx_appointments_client ON appointments(client_id);
CREATE INDEX idx_appointments_collaborator ON appointments(collaborator_id);
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_business_date ON appointments(business_id, date);
CREATE INDEX idx_appointment_services_appointment ON appointment_services(appointment_id);
CREATE INDEX idx_appointment_services_business ON appointment_services(business_id);

-- ============================================================
-- TRIGGERS (updated_at)
-- ============================================================

-- Reuse the update_updated_at() function from 001_initial_schema.sql
CREATE TRIGGER set_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_collaborators_updated_at BEFORE UPDATE ON collaborators FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborator_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON categories USING (
  get_user_role() IN ('master_admin', 'sub_admin') OR business_id = get_business_id()
);
CREATE POLICY tenant_isolation ON services USING (
  get_user_role() IN ('master_admin', 'sub_admin') OR business_id = get_business_id()
);
CREATE POLICY tenant_isolation ON collaborators USING (
  get_user_role() IN ('master_admin', 'sub_admin') OR business_id = get_business_id()
);
CREATE POLICY tenant_isolation ON collaborator_services USING (
  get_user_role() IN ('master_admin', 'sub_admin') OR business_id = get_business_id()
);
CREATE POLICY tenant_isolation ON clients USING (
  get_user_role() IN ('master_admin', 'sub_admin') OR business_id = get_business_id()
);
CREATE POLICY tenant_isolation ON appointments USING (
  get_user_role() IN ('master_admin', 'sub_admin') OR business_id = get_business_id()
);
CREATE POLICY tenant_isolation ON appointment_services USING (
  get_user_role() IN ('master_admin', 'sub_admin') OR business_id = get_business_id()
);
