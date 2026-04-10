ALTER TABLE host_jobs RENAME TO host_jobs_old;

CREATE TABLE host_jobs (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  step TEXT NOT NULL,
  worker_kind TEXT NOT NULL CHECK (worker_kind IN ('research-worker', 'draft-worker', 'future-worker', 'publish-worker')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'skipped')),
  priority INTEGER NOT NULL DEFAULT 100,
  payload_json TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT,
  lease_expires_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id)
);

INSERT INTO host_jobs (
  id,
  host_id,
  run_id,
  step,
  worker_kind,
  status,
  priority,
  payload_json,
  attempt_count,
  lease_owner,
  lease_expires_at,
  last_error,
  created_at,
  updated_at
)
SELECT
  id,
  host_id,
  run_id,
  step,
  worker_kind,
  status,
  priority,
  payload_json,
  attempt_count,
  lease_owner,
  lease_expires_at,
  last_error,
  created_at,
  updated_at
FROM host_jobs_old;

DROP TABLE host_jobs_old;

CREATE INDEX IF NOT EXISTS idx_host_jobs_worker_status_priority
  ON host_jobs(worker_kind, status, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_host_jobs_host_run
  ON host_jobs(host_id, run_id, status);
