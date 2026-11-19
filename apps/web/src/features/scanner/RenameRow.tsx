import { css } from '@/styled-system/css';
import { displayPath } from '@/lib/paths.js';
import { useRomsRoot } from '@/lib/use-roms-root.js';
import type { WrongNameEntry } from '@shared/scan.js';

/** One misnamed file: its current name, the canonical one, and a checkbox to rename it. */
export function RenameRow({
  entry,
  checked,
  onToggle,
}: {
  entry: WrongNameEntry;
  checked: boolean;
  onToggle: (p: string) => void;
}) {
  const romsRoot = useRomsRoot();
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
          <span className={css({ color: 'status.success.text' })}>{entry.canonicalName}</span>
        </span>
        <span className={css({ fontSize: 'xs', color: 'fg.faint' })}>{entry.gameName}</span>
      </div>
    </label>
  );
}
