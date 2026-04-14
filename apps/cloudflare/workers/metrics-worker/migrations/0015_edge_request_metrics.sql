CREATE TABLE IF NOT EXISTS metrics_edge_requests_hourly (
  site_key TEXT NOT NULL,
  concept_key TEXT NOT NULL,
  request_date TEXT NOT NULL,
  request_hour TEXT NOT NULL,
  path TEXT NOT NULL,
  page_type TEXT NOT NULL,
  referrer_type TEXT NOT NULL,
  referrer_host TEXT NOT NULL,
  ua_type TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (
    site_key,
    concept_key,
    request_date,
    request_hour,
    path,
    page_type,
    referrer_type,
    referrer_host,
    ua_type,
    status_code
  )
);

CREATE INDEX IF NOT EXISTS idx_metrics_edge_requests_hourly_scope
ON metrics_edge_requests_hourly(site_key, concept_key, request_date, request_hour);
