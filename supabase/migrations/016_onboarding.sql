-- 016: Onboarding multi-step registration support

-- ============================================
-- 1. profiles: make document optional, add onboarding flag
-- ============================================

-- Drop existing unique constraints on document
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_document_unique;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_document_key;

-- Make document and document_type nullable
ALTER TABLE profiles ALTER COLUMN document DROP NOT NULL;
ALTER TABLE profiles ALTER COLUMN document_type DROP NOT NULL;

-- Add onboarding_completed flag
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Re-add partial unique index (only enforces uniqueness for non-null documents)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_document_unique
  ON profiles (document) WHERE document IS NOT NULL;

-- ============================================
-- 2. businesses: add segment and business_type
-- ============================================

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS segment text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS business_type text;

-- ============================================
-- 3. onboarding_answers table
-- ============================================

CREATE TABLE IF NOT EXISTS onboarding_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  professionals_count text NOT NULL,
  monthly_appointments_range text NOT NULL,
  current_scheduling_method text NOT NULL,
  current_system_usage text NOT NULL,
  main_difficulty text NOT NULL,
  monthly_revenue_range text NOT NULL,
  main_goal text NOT NULL,
  whatsapp_automation_interest text NOT NULL,
  public_booking_page_interest text NOT NULL,
  digital_catalog_interest text NOT NULL,
  best_contact_time text NOT NULL,
  accepted_terms boolean NOT NULL DEFAULT false,
  accepted_marketing boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One onboarding answer per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_answers_user_id
  ON onboarding_answers (user_id);

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_onboarding_answers_business_id
  ON onboarding_answers (business_id);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS trg_onboarding_answers_updated_at ON onboarding_answers;
CREATE TRIGGER trg_onboarding_answers_updated_at
  BEFORE UPDATE ON onboarding_answers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 4. RLS for onboarding_answers
-- ============================================

ALTER TABLE onboarding_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS onboarding_answers_select ON onboarding_answers;
CREATE POLICY onboarding_answers_select ON onboarding_answers FOR SELECT USING (
  get_user_role() IN ('master_admin', 'sub_admin')
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS onboarding_answers_insert ON onboarding_answers;
CREATE POLICY onboarding_answers_insert ON onboarding_answers FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS onboarding_answers_update ON onboarding_answers;
CREATE POLICY onboarding_answers_update ON onboarding_answers FOR UPDATE USING (
  get_user_role() IN ('master_admin', 'sub_admin')
  OR user_id = auth.uid()
);

-- ============================================
-- 5. Mark existing users as onboarding_completed
-- ============================================

UPDATE profiles SET onboarding_completed = true WHERE id IS NOT NULL;
