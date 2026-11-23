import { css } from '@/styled-system/css';
import { displayPath } from '@/lib/paths.js';
import { useRomsRoot } from '@/lib/use-roms-root.js';
import type { WrongNameEntry } from '@shared/scan.js';

/** One misnamed file: its current name, the canonical one, and a checkbox to rename it. */
export function RenameRow({
  entry,
  checked,
  choice,
  onToggle,
  onChoose,
}: {
  entry: WrongNameEntry;
  checked: boolean;
  /** The name picked among the alternatives, if any. */
  choice?: string;
  onToggle: (p: string) => void;
  onChoose: (filePath: string, name: string) => void;
}) {
  const romsRoot = useRomsRoot();
  const { alternatives } = entry;
  const isChoicePending = alternatives !== undefined && choice === undefined;
  return (
    <label
      className={css({
        display: 'flex',
        alignItems: 'flex-start',
        gap: '3',
        px: '3',
        py: '2',
        cursor: 'pointer',
        bg: checked ? 'status.warning.subtle' : 'bg.page',
        _hover: { bg: checked ? 'status.warning.subtle' : 'bg.surface' },
        _last: { borderBottom: 'none' },
      })}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={isChoicePending}
        onChange={() => onToggle(entry.filePath)}
        className={css({ mt: '0.5', flexShrink: 0 })}
      />
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '0.5', minW: 0 })}>
        <span
          className={css({ fontSize: 'xs', color: 'fg.faint', fontFamily: 'mono', truncate: true })}
        >
          {displayPath(entry.filePath, romsRoot)}
        </span>
        <span className={css({ fontSize: 'sm', color: 'fg.default' })}>
          <span className={css({ color: 'status.danger.text' })}>{entry.currentName}</span>
          {' → '}
          {alternatives === undefined ? (
            <span className={css({ color: 'status.success.text' })}>{entry.canonicalName}</span>
          ) : (
            <select
              aria-label={`Nom à donner à ${entry.currentName}`}
              value={choice ?? ''}
              onChange={(e) => onChoose(entry.filePath, e.target.value)}
              className={css({ px: '2', maxW: 'full', fontSize: 'xs', borderRadius: '9px' })}
            >
              <option value="">Choisir un nom…</option>
              {alternatives.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </span>
        <span className={css({ fontSize: 'xs', color: 'fg.faint' })}>
          {alternatives === undefined
            ? entry.gameName
            : 'Fichier identique dans plusieurs jeux : impossible de savoir lequel.'}
        </span>
      </div>
    </label>
  );
}
