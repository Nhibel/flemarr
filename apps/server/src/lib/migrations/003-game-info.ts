// Game info from ScreenScraper (year, genre, publisher, synopses). Cached
// independently from the boxart probe: info_fetched_at NULL = never asked.
// Both languages are stored on every fetch so switching the language
// setting never costs a new API call (their quotas are tight).
export const migration003 = `
ALTER TABLE game_details ADD COLUMN year INTEGER;
ALTER TABLE game_details ADD COLUMN genre TEXT;
ALTER TABLE game_details ADD COLUMN publisher TEXT;
ALTER TABLE game_details ADD COLUMN description_fr TEXT;
ALTER TABLE game_details ADD COLUMN description_en TEXT;
ALTER TABLE game_details ADD COLUMN info_fetched_at INTEGER;
`;
