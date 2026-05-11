-- Add hero_layout and show_hero_badges to businesses
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS hero_layout text NOT NULL DEFAULT 'split'
    CHECK (hero_layout IN ('split', 'fullcover', 'minimal')),
  ADD COLUMN IF NOT EXISTS show_hero_badges boolean NOT NULL DEFAULT true;
