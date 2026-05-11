-- 009_cancel_reason_and_client_stats.sql
-- P3: Add cancel_reason column to appointments (prevents notes overwrite)
-- P6: Add function to count appointments per client for list endpoint

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancel_reason text;
