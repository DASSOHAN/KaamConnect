CREATE TABLE IF NOT EXISTS job_media (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK(media_type IN ('photo','voice')),
  storage_name TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  duration_seconds REAL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_job_media_job ON job_media(job_id, created_at);
INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(4, datetime('now'));
