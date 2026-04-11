CREATE TABLE IF NOT EXISTS metrics_gsc (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  site_url TEXT NOT NULL,
  dimensions_json TEXT,
  metrics_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_metrics_gsc_host_date ON metrics_gsc(host_id, metric_date);

CREATE TABLE IF NOT EXISTS metrics_crux (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  site_url TEXT NOT NULL,
  form_factor TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_metrics_crux_host_date ON metrics_crux(host_id, metric_date);

CREATE TABLE IF NOT EXISTS metrics_bing (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  site_url TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_metrics_bing_host_date ON metrics_bing(host_id, metric_date);

CREATE TABLE IF NOT EXISTS indexnow_submissions (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  host TEXT NOT NULL,
  url_count INTEGER NOT NULL,
  status TEXT NOT NULL,
  detail_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_indexnow_submissions_host_date ON indexnow_submissions(host_id, submitted_at);
