// thumbnails.libretro.com went empty on 2026-11-21: every game probed that
// day was cached as "no boxart", hiding it for the 30-day miss TTL. The
// lookup now falls back to the GitHub mirror; dropping the misses makes
// those games probed again, through it. Hits stay cached.
export const migration007 = `
DELETE FROM game_details WHERE boxart_url IS NULL;
`;
