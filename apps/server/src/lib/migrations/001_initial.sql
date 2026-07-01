CREATE TABLE IF NOT EXISTS dats (
  id TEXT PRIMARY KEY,
  system TEXT NOT NULL,
  source TEXT NOT NULL,
  version TEXT,
  date TEXT,
  games_json TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS archive_sources (
  identifier TEXT PRIMARY KEY,
  system TEXT NOT NULL,
  layout TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_archive_sources_system ON archive_sources(system);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_paths (
  system TEXT PRIMARY KEY,
  path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS download_history (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  rom_name TEXT NOT NULL,
  dat_id TEXT NOT NULL,
  destination TEXT NOT NULL,
  expected_crc TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  completed_at INTEGER NOT NULL DEFAULT (unixepoch())
);
