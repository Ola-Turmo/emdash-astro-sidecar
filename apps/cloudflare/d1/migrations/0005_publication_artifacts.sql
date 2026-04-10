CREATE TABLE IF NOT EXISTS publication_events (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('artifact_built', 'published', 'publish_failed')),
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id),
  FOREIGN KEY (draft_id) REFERENCES drafts(id)
);

CREATE TABLE IF NOT EXISTS publication_artifacts (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  artifact_format TEXT NOT NULL CHECK (artifact_format IN ('mdx')),
  artifact_content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id),
  FOREIGN KEY (draft_id) REFERENCES drafts(id)
);

CREATE INDEX IF NOT EXISTS idx_publication_events_host_draft
  ON publication_events(host_id, draft_id, created_at);

CREATE INDEX IF NOT EXISTS idx_publication_artifacts_host_draft
  ON publication_artifacts(host_id, draft_id, created_at);
