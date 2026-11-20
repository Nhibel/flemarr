import { css } from '@/styled-system/css';

/**
 * Which configured sources a resolve searches. Nothing ticked means all of
 * them — the default, so the filter can only narrow a search on purpose,
 * never by being forgotten. Worth it on a set split across several items
 * (one per letter range): ticking the right part skips the others' probes.
 */
export function SourceFilter({
  sources,
  picked,
  onToggle,
}: {
  sources: string[];
  /** Ticked identifiers; empty = every source. */
  picked: string[];
  onToggle: (identifier: string) => void;
}) {
  const searchesEverything = picked.length === 0;

  return (
    <fieldset className={css({ mb: '3', border: 'none', p: 0, m: 0 })}>
      <legend className={css({ fontSize: 'sm', color: 'fg.default', mb: '1.5' })}>
        Chercher dans{' '}
        <span className={css({ color: 'fg.faint' })}>
          {searchesEverything ? '— toutes les sources' : `— ${picked.length} sur ${sources.length}`}
        </span>
      </legend>
      <div className={css({ display: 'flex', flexWrap: 'wrap', rowGap: '1.5', columnGap: '3' })}>
        {sources.map((identifier) => (
          <label
            key={identifier}
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '1.5',
              fontSize: 'xs',
              fontFamily: 'mono',
              color: 'fg.muted',
              cursor: 'pointer',
            })}
          >
            <input
              type="checkbox"
              checked={picked.includes(identifier)}
              onChange={() => onToggle(identifier)}
            />
            {identifier}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
