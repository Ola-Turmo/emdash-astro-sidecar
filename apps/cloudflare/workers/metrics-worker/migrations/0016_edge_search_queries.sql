CREATE TABLE IF NOT EXISTS metrics_edge_search_queries_hourly (
  site_key TEXT NOT NULL,
  concept_key TEXT NOT NULL,
  request_date TEXT NOT NULL,
  request_hour TEXT NOT NULL,
  path TEXT NOT NULL,
  search_engine TEXT NOT NULL,
  query_term TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (
    site_key,
    concept_key,
    request_date,
    request_hour,
    path,
    search_engine,
    query_term
  )
);

CREATE INDEX IF NOT EXISTS idx_metrics_edge_search_queries_scope
ON metrics_edge_search_queries_hourly(site_key, concept_key, request_date, request_hour);
