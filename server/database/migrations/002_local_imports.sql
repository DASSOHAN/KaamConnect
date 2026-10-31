CREATE TABLE IF NOT EXISTS import_migrations(
  source TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
INSERT OR IGNORE INTO schema_migrations(version,applied_at) VALUES(2,datetime('now'));
