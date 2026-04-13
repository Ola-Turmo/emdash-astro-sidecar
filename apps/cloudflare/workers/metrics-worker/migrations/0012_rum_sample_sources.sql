ALTER TABLE metrics_rum ADD COLUMN sample_source TEXT;
ALTER TABLE metrics_rum ADD COLUMN session_id TEXT;

UPDATE metrics_rum
SET sample_source = COALESCE(sample_source, 'legacy_unknown')
WHERE sample_source IS NULL;

CREATE INDEX IF NOT EXISTS idx_metrics_rum_source_time
  ON metrics_rum(site_key, concept_key, sample_source, metric_name, collected_at);
