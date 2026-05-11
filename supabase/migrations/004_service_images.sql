-- 004_service_images.sql
-- Add image_url to services

ALTER TABLE services ADD COLUMN image_url text;
