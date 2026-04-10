CREATE TABLE IF NOT EXISTS publication_materializations (
  id TEXT PRIMARY KEY,
  artifact_id TEXT NOT NULL,
  host_id TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'materialized', 'deployed')),
  suggested_path TEXT NOT NULL,
  materialized_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id),
  FOREIGN KEY (draft_id) REFERENCES drafts(id),
  FOREIGN KEY (artifact_id) REFERENCES publication_artifacts(id)
);

CREATE INDEX IF NOT EXISTS idx_publication_materializations_status
  ON publication_materializations(status, created_at);
