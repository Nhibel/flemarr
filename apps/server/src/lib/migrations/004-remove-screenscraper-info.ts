// Retires the ScreenScraper game-info feature (phase 11): the columns
// migration003 added, and the settings keys that held the account
// credentials and the description-language preference. Box art
// (migration002, libretro-thumbnails) is untouched — it never depended on
// ScreenScraper.
export const migration004 = `
ALTER TABLE game_details DROP COLUMN year;
ALTER TABLE game_details DROP COLUMN genre;
ALTER TABLE game_details DROP COLUMN publisher;
ALTER TABLE game_details DROP COLUMN description_fr;
ALTER TABLE game_details DROP COLUMN description_en;
ALTER TABLE game_details DROP COLUMN info_fetched_at;
DELETE FROM settings WHERE key IN (
  'screen_scraper_ssid',
  'screen_scraper_ss_password',
  'screen_scraper_dev_id',
  'screen_scraper_dev_password',
  'description_language'
);
`;
