-- Keep delivery independent from saving a request. Existing requests are not emailed retroactively.
CREATE TABLE IF NOT EXISTS submission_notifications (
  submission_id TEXT PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS notification_due ON submission_notifications(status, next_attempt_at);
CREATE TRIGGER IF NOT EXISTS queue_submission_notification
AFTER INSERT ON submissions
BEGIN
  INSERT INTO submission_notifications (submission_id) VALUES (NEW.id);
END;
