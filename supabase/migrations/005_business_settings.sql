-- 005: Add settings columns to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS facebook text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS tiktok text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS welcome_message text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#4F5AE5';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cancellation_policy text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS booking_enabled boolean DEFAULT true;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS booking_settings jsonb DEFAULT '{"min_interval_minutes":0,"min_advance_hours":1,"max_advance_days":30,"allow_overlap":false,"auto_confirm":false}'::jsonb;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS notification_settings jsonb DEFAULT '{"email_reminder_enabled":false,"reminder_advance_hours":24,"confirmation_template":"Seu agendamento foi confirmado!","reminder_template":"Lembrete: voce tem um agendamento amanha."}'::jsonb;
