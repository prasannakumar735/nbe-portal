-- Door service alert log: tracks which client+location batches have already received
-- an automated door-service-due email, to prevent duplicate sends.

CREATE TABLE IF NOT EXISTS door_service_alert_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_location_id  UUID        NOT NULL REFERENCES client_locations(id) ON DELETE CASCADE,
  -- Array of door IDs included in this alert batch
  door_ids            UUID[]      NOT NULL DEFAULT '{}',
  door_count          INT         NOT NULL DEFAULT 0,
  -- Earliest and latest due dates among the doors in this batch
  earliest_due_date   DATE        NOT NULL,
  latest_due_date     DATE        NOT NULL,
  lead_time_days      INT         NOT NULL DEFAULT 15,
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS door_service_alert_log_client_location_idx
  ON door_service_alert_log (client_location_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS door_service_alert_log_client_idx
  ON door_service_alert_log (client_id, sent_at DESC);

-- Portal notification settings: key/value store for admin-configurable settings.
CREATE TABLE IF NOT EXISTS portal_notification_settings (
  key         TEXT        PRIMARY KEY,
  value       TEXT        NOT NULL,
  description TEXT        NULL,
  updated_by  UUID        NULL REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default: alert managers 15 days before a door's service due date.
INSERT INTO portal_notification_settings (key, value, description)
VALUES (
  'door_service_lead_time_days',
  '15',
  'How many days before a door service due date to email managers. Default: 15.'
)
ON CONFLICT (key) DO NOTHING;

-- Default: service interval in months (doors need service every N months).
INSERT INTO portal_notification_settings (key, value, description)
VALUES (
  'door_service_interval_months',
  '6',
  'How many months between door services before a door is considered overdue. Default: 6.'
)
ON CONFLICT (key) DO NOTHING;
