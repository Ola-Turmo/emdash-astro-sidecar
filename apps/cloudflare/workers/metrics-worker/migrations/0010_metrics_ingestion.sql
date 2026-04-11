CREATE TABLE IF NOT EXISTS metrics_gsc (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  page TEXT,
  query TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  ctr REAL,
  position REAL
);

CREATE INDEX IF NOT EXISTS idx_metrics_gsc_host_date ON metrics_gsc(host_id, metric_date);

CREATE TABLE IF NOT EXISTS metrics_crux (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  metric_week TEXT NOT NULL,
  url TEXT,
  lcp_p75 REAL,
  inp_p75 REAL,
  cls_p75 REAL
);

CREATE INDEX IF NOT EXISTS idx_metrics_crux_host_date ON metrics_crux(host_id, metric_week);

CREATE TABLE IF NOT EXISTS metrics_bing (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  page TEXT,
  query TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0
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
