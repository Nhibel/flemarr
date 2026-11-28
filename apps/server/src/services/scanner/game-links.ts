import type { Database } from 'better-sqlite3';
import type { DatFile, Game } from '@shared/dat.js';
import type { GameLink } from '@shared/game-link.js';
import { getDb } from '@/lib/db.js';

interface GameLinkRow {
  file_crc: string;
  game_id: string;
  game_name: string;
}

/** One file can stand for a whole game only when the game is one file. */
export function isLinkable(game: Game): boolean {
  return game.roms.length === 1;
}

function resolveGame(row: GameLinkRow, dat: DatFile): Game | undefined {
  const linkable = dat.games.filter(isLinkable);
  return (
    linkable.find((game) => game.id === row.game_id) ??
    linkable.find((game) => game.name === row.game_name)
  );
}

/** The DAT's links, each pointing at the game as the DAT now has it. */
export function listGameLinks(datId: string, dat: DatFile, db: Database = getDb()): GameLink[] {
  const rows = db
    .prepare(
      `SELECT file_crc, game_id, game_name FROM game_links WHERE dat_id = ? ORDER BY file_crc`,
    )
    .all(datId) as GameLinkRow[];
  return rows.map((row) => {
    const game = resolveGame(row, dat);
    return {
      fileCrc: row.file_crc,
      gameId: game?.id ?? null,
      gameName: game?.name ?? row.game_name,
    };
  });
}

export function saveGameLink(
  datId: string,
  fileCrc: string,
  game: Game,
  db: Database = getDb(),
): void {
  db.prepare(
    `INSERT INTO game_links (dat_id, file_crc, game_id, game_name) VALUES (?, ?, ?, ?)
     ON CONFLICT(dat_id, file_crc) DO UPDATE SET
       game_id = excluded.game_id,
       game_name = excluded.game_name`,
  ).run(datId, fileCrc, game.id, game.name);
}

/** Saves every link, or none if one fails. */
export function saveGameLinks(
  datId: string,
  links: { fileCrc: string; game: Game }[],
  db: Database = getDb(),
): void {
  db.transaction(() => {
    for (const { fileCrc, game } of links) saveGameLink(datId, fileCrc, game, db);
  })();
}

export function deleteGameLink(datId: string, fileCrc: string, db: Database = getDb()): boolean {
  const { changes } = db
    .prepare(`DELETE FROM game_links WHERE dat_id = ? AND file_crc = ?`)
    .run(datId, fileCrc);
  return changes > 0;
}

export function deleteGameLinks(datId: string, db: Database = getDb()): void {
  db.prepare(`DELETE FROM game_links WHERE dat_id = ?`).run(datId);
}
