CREATE TABLE IF NOT EXISTS metrics_crux_samples (
  id TEXT PRIMARY KEY,
  site_key TEXT NOT NULL,
  concept_key TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  target_value TEXT NOT NULL,
  form_factor TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  lcp_p75 REAL,
  inp_p75 REAL,
  cls_p75 REAL,
  raw_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_metrics_crux_samples_scope_time
ON metrics_crux_samples(site_key, concept_key, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_metrics_crux_samples_target
ON metrics_crux_samples(site_key, concept_key, target_kind, target_value, form_factor, collected_at DESC);
