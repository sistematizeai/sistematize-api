-- Per-day-of-week schedule for collaborators with lunch break support
CREATE TABLE IF NOT EXISTS collaborator_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  collaborator_id uuid NOT NULL REFERENCES collaborators(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_working boolean NOT NULL DEFAULT true,
  work_start time NOT NULL DEFAULT '08:00',
  work_end time NOT NULL DEFAULT '18:00',
  lunch_start time,
  lunch_end time,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(collaborator_id, day_of_week),
  CHECK (work_start < work_end),
  CHECK (lunch_start IS NULL OR lunch_end IS NULL OR (lunch_start < lunch_end AND lunch_start >= work_start AND lunch_end <= work_end))
);

ALTER TABLE collaborator_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collaborator_schedules_tenant_isolation" ON collaborator_schedules
  USING (business_id = get_business_id());
