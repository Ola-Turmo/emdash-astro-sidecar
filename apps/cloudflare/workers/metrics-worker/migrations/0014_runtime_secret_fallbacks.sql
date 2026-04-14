CREATE TABLE IF NOT EXISTS runtime_secret_fallbacks (
  worker_name TEXT NOT NULL,
  secret_name TEXT NOT NULL,
  secret_value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (worker_name, secret_name)
);
