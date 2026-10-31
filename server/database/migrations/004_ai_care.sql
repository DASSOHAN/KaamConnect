CREATE TABLE IF NOT EXISTS ai_care_sessions (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  session_token TEXT NOT NULL,
  appliance_category TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'NEED_MORE_INFORMATION',
  recommended_action TEXT NOT NULL DEFAULT 'ASK_FOLLOW_UP',
  problem_summary TEXT NOT NULL DEFAULT '{}',
  suggested_service_category TEXT,
  safety_flags TEXT NOT NULL DEFAULT '[]',
  multi_appliance_data TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_care_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES ai_care_sessions(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK(sender IN ('customer', 'assistant', 'system')),
  content TEXT NOT NULL,
  structured_payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_care_sessions_customer ON ai_care_sessions(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_care_sessions_token ON ai_care_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_ai_care_messages_session ON ai_care_messages(session_id, created_at);
INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(4, datetime('now'));
