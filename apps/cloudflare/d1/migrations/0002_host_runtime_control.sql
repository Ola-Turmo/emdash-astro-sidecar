CREATE TABLE IF NOT EXISTS host_runtime_state (
  host_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('idle', 'running', 'cooldown')),
  cooldown_until TEXT,
  lock_owner TEXT,
  lock_expires_at TEXT,
  last_run_started_at TEXT,
  last_run_finished_at TEXT,
  last_run_reason TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id)
);

CREATE TABLE IF NOT EXISTS host_run_events (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('run_requested', 'run_acquired', 'run_blocked', 'run_completed', 'run_failed')),
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id)
);
