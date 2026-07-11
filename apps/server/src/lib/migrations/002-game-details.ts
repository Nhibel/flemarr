// Per-game details fetched from external providers (libretro-thumbnails…),
// cached so each game hits the provider at most once. A row with a NULL
// boxart_url is a negative cache entry: the provider was asked and had
// nothing — kept so misses aren't re-probed on every page visit.
export const migration002 = `
CREATE TABLE IF NOT EXISTS game_details (
  dat_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  boxart_url TEXT,
  description TEXT,
  fetched_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (dat_id, game_id)
);
`;
