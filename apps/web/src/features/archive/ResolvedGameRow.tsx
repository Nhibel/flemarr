import { css } from '@/styled-system/css';
import type { ResolveResponse } from '@/lib/api.js';

interface Props {
  game: ResolveResponse['results'][number];
  // Keyed by `${gameId}/${romName}` — absent means "use the first source",
  // same default as before this picker existed.
  selectedSourceIndex: Map<string, number>;
  onSelectSource: (gameId: string, romName: string, index: number) => void;
}

export function ResolvedGameRow({ game, selectedSourceIndex, onSelectSource }: Props) {
  const foundCount = game.roms.filter((rom) => rom.sources.length > 0).length;
  const allFound = game.roms.length > 0 && foundCount === game.roms.length;
  const noneFound = foundCount === 0;

  const containerStyle = css.raw(
    allFound
      ? { borderColor: 'status.success.subtleBorder', bg: 'status.success.subtle' }
      : noneFound
        ? { borderColor: 'bd.default', bg: 'bg.page' }
        : { borderColor: 'status.warning.subtleBorder', bg: 'status.warning.subtle' },
  );

  return (
    <div className={css({ p: '3', border: '1px solid', borderRadius: 'xl' }, containerStyle)}>
      <div className={css({ display: 'flex', alignItems: 'flex-start', gap: '2' })}>
        <span
          className={css({
            fontSize: 'sm',
            color: allFound
              ? 'status.success.text'
              : noneFound
                ? 'fg.faint'
                : 'status.warning.text',
            mt: '0.5',
          })}
        >
          {allFound ? '✓' : noneFound ? '—' : '◐'}
        </span>
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
                return (
                  <div key={rom.romName}>
                    <p
                      className={css({
                        fontSize: 'xs',
                        color:
                          source == null
                            ? 'fg.faint'
                            : source.verified
                              ? 'fg.subtle'
                              : 'status.warning.text',
                        fontFamily: 'mono',
                        truncate: true,
                      })}
                    >
                      {source == null
                        ? `— ${rom.romName} — introuvable`
                        : source.verified
                          ? `✓ ${rom.romName} — [${source.container}] ${source.identifier}`
                          : `⚠ ${rom.romName} — [${source.container}] ${source.identifier} (nom seul, CRC non confirmé)`}
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
                              borderRadius: 'md',
                              border: '1px solid',
                              cursor: 'pointer',
                              borderColor: i === chosenIndex ? 'accent.solid' : 'bd.strong',
                              bg: i === chosenIndex ? 'accent.subtle' : 'bg.surface',
                              color: i === chosenIndex ? 'accent.text' : 'fg.muted',
                              _hover: { borderColor: 'accent.hover' },
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
