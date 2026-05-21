ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'support';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'commercial';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'technical';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_permissions ON profiles USING gin(permissions);

UPDATE profiles
SET permissions = ARRAY['businesses.read','users.read','support.read']::text[]
WHERE role = 'sub_admin'
  AND permissions = '{}'::text[];
