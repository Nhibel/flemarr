import { css } from '@/styled-system/css';
import type { ResolveResponse } from '@/lib/api.js';

type ResolvedGame = ResolveResponse['results'][number];
type ResolvedSource = ResolvedGame['roms'][number]['sources'][number];

/** How many of the game's ROMs some source has: all, none, or some. */
type Coverage = 'all' | 'none' | 'partial';

function coverageOf(foundCount: number, romCount: number): Coverage {
  if (romCount > 0 && foundCount === romCount) return 'all';
  if (foundCount === 0) return 'none';
  return 'partial';
}

// The state is carried by the tinted fill alone, as everywhere else since
// the redesign — the 1px outline that used to repeat each of these hues
// added nothing the fill did not already say.
const COVERAGE_FILL = {
  all: css.raw({ bg: 'status.success.subtle', color: 'status.success.text' }),
  none: css.raw({ bg: 'bg.muted' }),
  partial: css.raw({ bg: 'status.warning.subtle', color: 'status.warning.text' }),
} satisfies Record<Coverage, unknown>;

const COVERAGE_MARK = {
  all: { glyph: '✓', style: css.raw({ color: 'status.success.text' }) },
  none: { glyph: '—', style: css.raw({ color: 'fg.faint' }) },
  partial: { glyph: '◐', style: css.raw({ color: 'status.warning.text' }) },
} satisfies Record<Coverage, unknown>;

/** The line under a ROM: which source it will come from, and how sure that match is. */
function describeSource(romName: string, source: ResolvedSource | undefined) {
  if (source == null) {
    return { text: `— ${romName} — introuvable`, style: css.raw({ color: 'fg.dataFaint' }) };
  }
  const where = `[${source.container}] ${source.identifier}`;
  if (source.verified) {
    return { text: `✓ ${romName} — ${where}`, style: css.raw({ color: 'fg.data' }) };
  }
  return {
    text: `⚠ ${romName} — ${where} (nom seul, CRC non confirmé)`,
    style: css.raw({ color: 'status.warning.text' }),
  };
}

interface Props {
  game: ResolvedGame;
  // Keyed by `${gameId}/${romName}` — absent means "use the first source",
  // same default as before this picker existed.
  selectedSourceIndex: Map<string, number>;
  onSelectSource: (gameId: string, romName: string, index: number) => void;
}

export function ResolvedGameRow({ game, selectedSourceIndex, onSelectSource }: Props) {
  const foundCount = game.roms.filter((rom) => rom.sources.length > 0).length;
  const coverage = coverageOf(foundCount, game.roms.length);
  const noneFound = coverage === 'none';
  const mark = COVERAGE_MARK[coverage];

  return (
    <div className={css({ p: '3', borderRadius: '14px' }, COVERAGE_FILL[coverage])}>
      <div className={css({ display: 'flex', alignItems: 'flex-start', gap: '2' })}>
        <span className={css({ fontSize: 'sm', mt: '0.5' }, mark.style)}>{mark.glyph}</span>
        <div className={css({ flex: 1, minW: 0 })}>
          <p className={css({ fontSize: 'sm', color: 'fg.heading', fontWeight: 'medium' })}>
            {game.gameName || game.gameId}
            {game.roms.length > 1 && (
              <span className={css({ fontWeight: 'normal', color: 'fg.faint' })}>
                {' '}
                — {foundCount}/{game.roms.length} disques
              </span>
            )}
          </p>
          {noneFound ? (
            <p className={css({ fontSize: 'xs', color: 'fg.faint', mt: '0.5' })}>
              Non trouvé dans les sources configurées
            </p>
          ) : (
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '1', mt: '1' })}>
              {game.roms.map((rom) => {
                const key = `${game.gameId}/${rom.romName}`;
                const chosenIndex = selectedSourceIndex.get(key) ?? 0;
                const source = rom.sources[chosenIndex] ?? rom.sources[0];
                const sourceLine = describeSource(rom.romName, source);
                return (
                  <div key={rom.romName}>
                    <p
                      className={css(
                        { fontSize: 'xs', fontFamily: 'mono', truncate: true },
                        sourceLine.style,
                      )}
                    >
                      {sourceLine.text}
                    </p>
                    {/* Only shown when there's an actual choice to make — a
                        single-source rom looks exactly like it did before
                        this picker existed. */}
                    {rom.sources.length > 1 && (
                      <div
                        className={css({
                          display: 'flex',
                          gap: '1',
                          flexWrap: 'wrap',
                          mt: '0.5',
                          ml: '3',
                        })}
                      >
                        {rom.sources.map((s, i) => (
                          <button
                            key={s.identifier}
                            type="button"
                            onClick={() => onSelectSource(game.gameId, rom.romName, i)}
                            title={`${s.container}${s.verified ? ' · CRC confirmé' : ' · nom seul'}`}
                            className={css({
                              px: '1.5',
                              py: '0.5',
                              fontSize: 'xs',
                              fontFamily: 'mono',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              bg: i === chosenIndex ? 'accent.solid' : 'bg.muted',
                              color: i === chosenIndex ? 'accent.fg' : 'fg.muted',
                              _hover: { color: i === chosenIndex ? 'accent.fg' : 'fg.default' },
                            })}
                          >
                            {s.identifier}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
