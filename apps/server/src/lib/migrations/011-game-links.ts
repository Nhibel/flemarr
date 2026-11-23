// Files the user attached to a game of the DAT although their CRC is not in
// it (another region or revision). Keyed by CRC, so a link survives renames
// and rescans. `game_name` finds the game again when a DAT update changes its
// id, which derives from the name and the first ROM's CRC.
export const migration011 = `
CREATE TABLE IF NOT EXISTS game_links (
  dat_id TEXT NOT NULL,
  file_crc TEXT NOT NULL,
  game_id TEXT NOT NULL,
  game_name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (dat_id, file_crc)
);
`;
