-- 007: Add image_url to combos table
ALTER TABLE combos ADD COLUMN IF NOT EXISTS image_url text;
