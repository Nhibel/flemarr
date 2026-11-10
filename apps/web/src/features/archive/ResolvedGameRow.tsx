import { css } from '@/styled-system/css';
import type { ResolveResponse } from '@/lib/api.js';

export function ResolvedGameRow({ game }: { game: ResolveResponse['results'][number] }) {
  const foundCount = game.roms.filter((rom) => rom.sources.length > 0).length;
  const allFound = game.roms.length > 0 && foundCount === game.roms.length;
  const noneFound = foundCount === 0;

  const containerStyle = css.raw(
    allFound
      ? {
          borderColor: 'green.200',
          bg: 'green.50',
          _dark: { bg: 'green.900', borderColor: 'green.800' },
        }
      : noneFound
        ? { borderColor: 'bd.default', bg: 'bg.page' }
        : {
            borderColor: 'amber.200',
            bg: 'amber.50',
            _dark: { bg: 'amber.900', borderColor: 'amber.800' },
          },
  );

  return (
    <div className={css({ p: '3', border: '1px solid', borderRadius: 'xl' }, containerStyle)}>
      <div className={css({ display: 'flex', alignItems: 'flex-start', gap: '2' })}>
        <span
          className={css({
            fontSize: 'sm',
            color: allFound ? 'green.700' : noneFound ? 'fg.faint' : 'amber.700',
            _dark: allFound
              ? { color: 'green.400' }
              : noneFound
                ? undefined
                : { color: 'amber.400' },
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
                const source = rom.sources[0];
                return (
                  <p
                    key={rom.romName}
                    className={css({
                      fontSize: 'xs',
                      color:
                        source == null ? 'fg.faint' : source.verified ? 'fg.subtle' : 'amber.700',
                      fontFamily: 'mono',
                      truncate: true,
                      _dark:
                        source != null && !source.verified ? { color: 'amber.400' } : undefined,
                    })}
                  >
                    {source == null
                      ? `— ${rom.romName} — introuvable`
                      : source.verified
                        ? `✓ ${rom.romName} — [${source.container}] ${source.identifier}`
                        : `⚠ ${rom.romName} — [${source.container}] ${source.identifier} (nom seul, CRC non confirmé)`}
                  </p>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
