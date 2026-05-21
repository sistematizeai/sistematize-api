-- 023: Notification delivery logs for email and future automation channels

CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  type text NOT NULL,
  recipient text,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  provider text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_business ON notification_delivery_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_appointment ON notification_delivery_logs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_channel_status ON notification_delivery_logs(channel, status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_delivery_logs(created_at);

ALTER TABLE notification_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_logs_select ON notification_delivery_logs FOR SELECT USING (
  get_user_role() IN ('master_admin', 'sub_admin')
  OR business_id = get_business_id()
);

CREATE POLICY notification_logs_insert ON notification_delivery_logs FOR INSERT WITH CHECK (true);
