CREATE TABLE IF NOT EXISTS source_documents (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  run_id TEXT,
  source_type TEXT NOT NULL,
  source_url TEXT,
  title TEXT,
  body_excerpt TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id)
);

CREATE TABLE IF NOT EXISTS source_snapshots (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  run_id TEXT,
  source_document_id TEXT,
  snapshot_type TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id),
  FOREIGN KEY (source_document_id) REFERENCES source_documents(id)
);

CREATE TABLE IF NOT EXISTS draft_sections (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  section_order INTEGER NOT NULL,
  heading TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (draft_id) REFERENCES drafts(id)
);

CREATE INDEX IF NOT EXISTS idx_source_documents_host_run
  ON source_documents(host_id, run_id, created_at);

CREATE INDEX IF NOT EXISTS idx_source_snapshots_host_run
  ON source_snapshots(host_id, run_id, created_at);

CREATE INDEX IF NOT EXISTS idx_draft_sections_draft
  ON draft_sections(draft_id, section_order);
