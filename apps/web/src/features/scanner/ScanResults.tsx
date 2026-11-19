import { css } from '@/styled-system/css';
import { Chip } from '@/components/Chip.js';
import { displayPath } from '@/lib/paths.js';
import { useRomsRoot } from '@/lib/use-roms-root.js';
import type { ScanResult } from '@shared/scan.js';
import { RenameRow } from './RenameRow.js';
import { plural } from '@/lib/plural.js';

interface ScanResultsProps {
  result: ScanResult;
  selected: Set<string>;
  onToggle: (p: string) => void;
  onRename: () => void;
  renaming: boolean;
  renameResult: { done: number; failed: number } | null;
}

/** The scan's outcome: counts, the misnamed files to rename, and what matched nothing. */
export function ScanResults({
  result,
  selected,
  onToggle,
  onRename,
  renaming,
  renameResult,
}: ScanResultsProps) {
  const romsRoot = useRomsRoot();
  const total = result.matched.length + result.wrongName.length + result.unmatched.length;

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
      {/* Summary chips */}
      <div className={css({ display: 'flex', gap: '3', flexWrap: 'wrap' })}>
        <Chip label="trouvés" count={result.matched.length} color="green" />
        <Chip label="mal nommés" count={result.wrongName.length} color="amber" />
        <Chip label="introuvables" count={result.unmatched.length} color="gray" />
        <span className={css({ fontSize: 'xs', color: 'fg.faint', alignSelf: 'center' })}>
          {total} fichiers scannés
        </span>
      </div>

      {/* Rename suggestions */}
      {result.wrongName.length > 0 && (
        <div>
          <div className={css({ display: 'flex', alignItems: 'center', gap: '3', mb: '2' })}>
            <h3 className={css({ fontSize: 'sm', fontWeight: 'semibold', color: 'fg.default' })}>
              Suggestions de renommage
            </h3>
            <button
              onClick={() => result.wrongName.forEach((e) => onToggle(e.filePath))}
              className={css({
                fontSize: 'xs',
                color: 'accent.text',
                cursor: 'pointer',
                _hover: { textDecoration: 'underline' },
              })}
            >
              {selected.size === result.wrongName.length
                ? 'Tout désélectionner'
                : 'Tout sélectionner'}
            </button>
          </div>
          <div
            className={css({
              borderRadius: 'xl',
              overflow: 'hidden',
            })}
          >
            {result.wrongName.map((entry) => (
              <RenameRow
                key={entry.filePath}
                entry={entry}
                checked={selected.has(entry.filePath)}
                onToggle={onToggle}
              />
            ))}
          </div>
          <div className={css({ mt: '3', display: 'flex', alignItems: 'center', gap: '3' })}>
            <button
              onClick={onRename}
              disabled={selected.size === 0 || renaming}
              className={css({
                px: '4',
                py: '2',
                bg: 'status.warning.solid',
                color: 'status.warning.fg',
                borderRadius: 'lg',
                fontSize: 'sm',
                fontWeight: 'medium',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
                _hover: { bg: 'status.warning.hover' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {renaming
                ? 'Renommage…'
                : `Renommer ${selected.size} ${plural(selected.size, 'fichier')}`}
            </button>
            {renameResult && (
              <span
                className={css({
                  fontSize: 'sm',
                  color: renameResult.failed > 0 ? 'status.danger.text' : 'status.success.text',
                })}
              >
                {renameResult.done} {plural(renameResult.done, 'renommé')}
                {renameResult.failed > 0
                  ? `, ${renameResult.failed} ${plural(renameResult.failed, 'échoué')}`
                  : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Unmatched */}
      {result.unmatched.length > 0 && (
        <details className={css({ fontSize: 'sm' })}>
          <summary className={css({ cursor: 'pointer', color: 'fg.subtle', mb: '1' })}>
            {result.unmatched.length} {plural(result.unmatched.length, 'fichier')} non{' '}
            {plural(result.unmatched.length, 'trouvé')}
          </summary>
          <ul
            className={css({
              pl: '4',
              mt: '1',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5',
            })}
          >
            {result.unmatched.map((p) => (
              <li
                key={p}
                className={css({
                  color: 'fg.subtle',
                  fontFamily: 'mono',
                  fontSize: 'xs',
                  truncate: true,
                })}
              >
                {displayPath(p, romsRoot)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
