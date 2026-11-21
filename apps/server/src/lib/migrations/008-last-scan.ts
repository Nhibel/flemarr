// The last scan of each DAT, so what the user owns survives a reload and
// shows on every device. One row per DAT: a new scan replaces the old one.
// `directory` is the folder scanned: a scan of a folder no longer set for
// the system says nothing about the current one.
export const migration008 = `
CREATE TABLE IF NOT EXISTS last_scans (
  dat_id TEXT PRIMARY KEY,
  directory TEXT NOT NULL,
  result_json TEXT NOT NULL,
  scanned_at INTEGER NOT NULL
);
`;
