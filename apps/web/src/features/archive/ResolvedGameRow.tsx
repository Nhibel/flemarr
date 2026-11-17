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

  // The state is carried by the tinted fill alone, as everywhere else since
  // the redesign — the 1px outline that used to repeat each of these hues
  // added nothing the fill did not already say.
  const containerStyle = css.raw(
    allFound
      ? { bg: 'status.success.subtle', color: 'status.success.text' }
      : noneFound
        ? { bg: 'bg.muted' }
        : { bg: 'status.warning.subtle', color: 'status.warning.text' },
  );

  return (
    <div className={css({ p: '3', borderRadius: '14px' }, containerStyle)}>
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
                            ? 'fg.dataFaint'
                            : source.verified
                              ? 'fg.data'
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
