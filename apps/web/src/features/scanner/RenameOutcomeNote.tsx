import { css } from '@/styled-system/css';
import { displayPath } from '@/lib/paths.js';
import { plural } from '@/lib/plural.js';
import { useRomsRoot } from '@/lib/use-roms-root.js';
import type { RenameOutcome } from './use-renames.js';

function folderOf(path: string): string {
  return path.slice(0, Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
}

/** What the last rename did, with the files left alone and why. */
export function RenameOutcomeNote({ outcome }: { outcome: RenameOutcome }) {
  const romsRoot = useRomsRoot();
  const { done, failed, skipped, error } = outcome;

  if (error !== undefined) {
    return (
      <p role="alert" className={css({ fontSize: 'sm', color: 'status.danger.text' })}>
        {error}
      </p>
    );
  }

  const failedNote = failed > 0 ? `, ${failed} ${plural(failed, 'échoué')}` : '';
  return (
    <div role="status" className={css({ fontSize: 'sm' })}>
      <p className={css({ color: failed > 0 ? 'status.danger.text' : 'status.success.text' })}>
        {`${done} ${plural(done, 'renommé')}${failedNote}`}
      </p>
      {skipped.length > 0 && (
        <>
          <p className={css({ color: 'status.warning.text', mt: '1' })}>
            {skipped.length} {plural(skipped.length, 'fichier')} {plural(skipped.length, 'laissé')}{' '}
            tel quel : un autre fichier porte déjà ce nom (doublon probable).
          </p>
          <ul className={css({ pl: '4', mt: '1', fontFamily: 'mono', fontSize: 'xs' })}>
            {skipped.map(({ entry }) => (
              <li
                key={entry.from}
                className={css({ color: 'fg.subtle', overflowWrap: 'anywhere' })}
              >
                {displayPath(entry.from, romsRoot)}
                {' ↔ '}
                {displayPath(folderOf(entry.from) + entry.to, romsRoot)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
