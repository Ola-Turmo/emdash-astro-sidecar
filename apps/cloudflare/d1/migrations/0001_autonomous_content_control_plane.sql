CREATE TABLE IF NOT EXISTS hosts (
  id TEXT PRIMARY KEY,
  host_name TEXT NOT NULL,
  site_url TEXT NOT NULL,
  base_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS host_modes (
  host_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('observe_only', 'draft_only', 'refresh_auto', 'publish_auto')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id)
);

CREATE TABLE IF NOT EXISTS host_budgets (
  host_id TEXT PRIMARY KEY,
  max_net_new_pages_per_week INTEGER NOT NULL,
  max_auto_refreshes_per_day INTEGER NOT NULL,
  max_draft_attempts_per_day INTEGER NOT NULL,
  max_provider_retries_per_hour INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id)
);

CREATE TABLE IF NOT EXISTS prompt_families (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  task_type TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES prompt_families(id)
);

CREATE TABLE IF NOT EXISTS prompt_runs (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  prompt_version_id TEXT NOT NULL,
  validation_score INTEGER NOT NULL,
  total_score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  mutation_operator TEXT NOT NULL,
  kept INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES prompt_families(id),
  FOREIGN KEY (prompt_version_id) REFERENCES prompt_versions(id)
);

CREATE TABLE IF NOT EXISTS topic_candidates (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id)
);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  topic_candidate_id TEXT,
  slug TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id),
  FOREIGN KEY (topic_candidate_id) REFERENCES topic_candidates(id)
);

CREATE TABLE IF NOT EXISTS draft_evals (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  criterion_id TEXT NOT NULL,
  passed INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (draft_id) REFERENCES drafts(id)
);

CREATE TABLE IF NOT EXISTS publications (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id),
  FOREIGN KEY (draft_id) REFERENCES drafts(id)
);

CREATE TABLE IF NOT EXISTS audit_runs (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  url TEXT NOT NULL,
  status_code INTEGER,
  findings_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES hosts(id)
);

CREATE TABLE IF NOT EXISTS metrics_gsc (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  page TEXT,
  query TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  ctr REAL,
  position REAL,
  FOREIGN KEY (host_id) REFERENCES hosts(id)
);

CREATE TABLE IF NOT EXISTS metrics_bing (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  page TEXT,
  query TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (host_id) REFERENCES hosts(id)
);

CREATE TABLE IF NOT EXISTS metrics_crux (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  metric_week TEXT NOT NULL,
  url TEXT,
  lcp_p75 REAL,
  inp_p75 REAL,
  cls_p75 REAL,
  FOREIGN KEY (host_id) REFERENCES hosts(id)
);
