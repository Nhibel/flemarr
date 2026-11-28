import type { Game } from '@shared/dat.js';
import type { UnmatchedFile } from '@shared/scan.js';
import { linkableGames, similarity, suggestGames, titleWords } from './suggest-games.js';

// Enough to pick from in a row's menu; the single-file dialog searches more.
const MAX_CANDIDATES = 5;

/** What "Tout rattacher" proposes for one file absent from the DAT. */
export interface LinkProposal {
  filePath: string;
  fileName: string;
  crc: string;
  /** The games whose title resembles the file's, most alike first. */
  candidates: Game[];
  /** The game picked by default: the first candidate. */
  gameId: string | null;
  /** Ticked by default: sure enough to save without a look. */
  checked: boolean;
}

function fileNameOf(path: string): string {
  return path.split(/[/\\]/).at(-1) ?? path;
}

function withoutExtension(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]{1,4}$/i, '');
}

/** The one game with exactly the file's title, if there is a single one. */
function onlySameTitle(fileName: string, candidates: Game[]): Game | undefined {
  const wanted = titleWords(withoutExtension(fileName));
  const same = candidates.filter((game) => similarity(wanted, titleWords(game.name)) === 1);
  return same.length === 1 ? same[0] : undefined;
}

/**
 * A proposal per file with a CRC. A file is ticked only when its title is
 * exactly that of a single game, the user does not own that game yet, and
 * no other file of the list points at it. The title says nothing of the
 * content: everything else waits for the user.
 */
export function proposeLinks(
  files: UnmatchedFile[],
  games: Game[],
  ownedGameNames: ReadonlySet<string>,
): LinkProposal[] {
  const linkable = linkableGames(games);
  const drafts = files.flatMap((file) => {
    if (file.crc === undefined) return [];
    const fileName = fileNameOf(file.filePath);
    const candidates = suggestGames(fileName, linkable).slice(0, MAX_CANDIDATES);
    const sure = onlySameTitle(fileName, candidates);
    const isSure = sure !== undefined && !ownedGameNames.has(sure.name);
    return [
      {
        filePath: file.filePath,
        fileName,
        crc: file.crc,
        candidates,
        sure: isSure ? sure : undefined,
      },
    ];
  });

  const filesPerSureGame = new Map<string, number>();
  for (const { sure } of drafts) {
    if (sure !== undefined) filesPerSureGame.set(sure.id, (filesPerSureGame.get(sure.id) ?? 0) + 1);
  }

  return drafts.map(({ sure, ...draft }) => {
    const isAlone = sure !== undefined && filesPerSureGame.get(sure.id) === 1;
    return {
      ...draft,
      gameId: sure?.id ?? draft.candidates[0]?.id ?? null,
      checked: isAlone,
    };
  });
}
