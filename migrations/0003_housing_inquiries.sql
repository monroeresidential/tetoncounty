-- Corporate housing inquiries live apart from guide suggestions so each has its own retention and notification path.
CREATE TABLE IF NOT EXISTS housing_inquiries (
  id TEXT PRIMARY KEY,
  requester TEXT NOT NULL CHECK(requester IN ('individual', 'employer')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  units INTEGER NOT NULL CHECK(units BETWEEN 1 AND 50),
  bedrooms TEXT NOT NULL CHECK(bedrooms IN ('1', '2', 'either')),
  move_in TEXT NOT NULL,
  stay_length TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS housing_notifications (
  inquiry_id TEXT PRIMARY KEY REFERENCES housing_inquiries(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS housing_notification_due ON housing_notifications(status, next_attempt_at);
CREATE TRIGGER IF NOT EXISTS queue_housing_notification
AFTER INSERT ON housing_inquiries
BEGIN
  INSERT INTO housing_notifications (inquiry_id) VALUES (NEW.id);
END;
