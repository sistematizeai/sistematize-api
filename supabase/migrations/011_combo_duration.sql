-- Add optional duration_minutes override to combos
ALTER TABLE combos ADD COLUMN IF NOT EXISTS duration_minutes integer;
