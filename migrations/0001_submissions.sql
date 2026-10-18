CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('addition', 'correction', 'contact')),
  listing_id TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  place_name TEXT NOT NULL DEFAULT '',
  town TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS submissions_status_date ON submissions(status, created_at);
CREATE TABLE IF NOT EXISTS submission_rate_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL
);
