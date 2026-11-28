import type { Game } from '@shared/dat.js';

const MAX_RESULTS = 30;
// Below this share of common words, two titles are not the same game.
const MIN_SIMILARITY = 0.5;

// No-Intro puts the article last: "Aventures de Buzz l'Eclair, Les".
const TRAILING_ARTICLE = /, (the|a|an|le|la|les|l'|der|die|das|el|los|las|il|lo|gli|i)\b/i;
// A file named by hand keeps it first: "The Legend of Zelda".
const LEADING_ARTICLE = /^(the|a|an|le|la|les|der|die|das|el|los|las|il|lo|gli) /i;

/** The words of a title, without its tags, extension, accents and article. */
export function titleWords(name: string): string[] {
  const title = name.split(' (')[0] ?? name;
  return (
    title
      .replace(TRAILING_ARTICLE, '')
      .replace(LEADING_ARTICLE, '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .match(/[a-z0-9]+/g) ?? []
  );
}

/** The share of words two titles have in common, from 0 to 1 (Dice). */
export function similarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const left = new Set(a);
  const right = new Set(b);
  const common = [...left].filter((word) => right.has(word)).length;
  return (2 * common) / (left.size + right.size);
}

/** One file can stand for a whole game only when the game is one file. */
export function linkableGames(games: Game[]): Game[] {
  return games.filter((game) => game.roms.length === 1);
}

/** The games whose title resembles the file's, most alike first. */
export function suggestGames(fileName: string, games: Game[]): Game[] {
  const wanted = titleWords(fileName.replace(/\.[a-z0-9]{1,4}$/i, ''));
  return games
    .map((game) => ({ game, score: similarity(wanted, titleWords(game.name)) }))
    .filter(({ score }) => score >= MIN_SIMILARITY)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(({ game }) => game);
}

/** The games whose name holds every word typed. */
export function searchGames(query: string, games: Game[]): Game[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return games
    .filter((game) => words.every((word) => game.name.toLowerCase().includes(word)))
    .slice(0, MAX_RESULTS);
}
