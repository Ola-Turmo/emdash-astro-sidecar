CREATE TABLE IF NOT EXISTS publication_edge_artifacts (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  html_content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id),
  FOREIGN KEY (draft_id) REFERENCES drafts(id)
);

CREATE INDEX IF NOT EXISTS idx_publication_edge_artifacts_slug
  ON publication_edge_artifacts(host_id, slug, created_at);

CREATE INDEX IF NOT EXISTS idx_publication_edge_artifacts_url
  ON publication_edge_artifacts(host_id, url, created_at);
