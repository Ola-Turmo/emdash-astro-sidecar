CREATE TABLE IF NOT EXISTS metrics_rum (
  id TEXT PRIMARY KEY,
  site_key TEXT NOT NULL,
  concept_key TEXT NOT NULL,
  page_path TEXT NOT NULL,
  page_type TEXT,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  rating TEXT,
  device_class TEXT,
  viewport_width INTEGER,
  viewport_height INTEGER,
  user_agent TEXT,
  collected_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_metrics_rum_scope_time
  ON metrics_rum(site_key, concept_key, metric_name, collected_at);

CREATE INDEX IF NOT EXISTS idx_metrics_rum_path_time
  ON metrics_rum(page_path, metric_name, collected_at);
