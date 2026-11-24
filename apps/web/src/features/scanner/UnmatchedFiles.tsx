import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { fetchGames } from '@/lib/api.js';
import { displayPath } from '@/lib/paths.js';
import { plural } from '@/lib/plural.js';
import { queryKeys } from '@/lib/query-keys.js';
import { useGameLinkMutations } from '@/lib/use-game-links.js';
import { useRomsRoot } from '@/lib/use-roms-root.js';
import { Foldable } from '@/components/Foldable.js';
import type { UnmatchedFile } from '@shared/scan.js';
import { LinkGameDialog } from './LinkGameDialog.js';
import type { LinkedFile } from './scan-summary.js';
import { sectionId } from './use-open-sections.js';
import type { ScanSection } from './use-open-sections.js';
import { linkableGames } from './suggest-games.js';

const linkButtonClass = css({
  flexShrink: 0,
  fontSize: 'xs',
  color: 'accent.text',
  cursor: 'pointer',
  _hover: { textDecoration: 'underline' },
  _disabled: { opacity: 0.5, cursor: 'not-allowed' },
});

const rowClass = css({ display: 'flex', alignItems: 'baseline', gap: '3' });

const pathClass = css({
  minW: 0,
  color: 'fg.subtle',
  fontFamily: 'mono',
  fontSize: 'xs',
  truncate: true,
});

function fileNameOf(path: string): string {
  return path.split(/[/\\]/).at(-1) ?? path;
}

/**
 * The files the DAT does not list, and the ones the user attached to a game.
 * Absent from the DAT is usually not an error: a 1G1R DAT keeps one version
 * of each game, and this file is another.
 */
export function UnmatchedFiles({
  datId,
  linked,
  unlinked,
  openSections,
  onOpenChange,
}: {
  datId: string;
  linked: LinkedFile[];
  unlinked: UnmatchedFile[];
  openSections: Record<ScanSection, boolean>;
  onOpenChange: (section: ScanSection, open: boolean) => void;
}) {
  const romsRoot = useRomsRoot();
  const { attach, detach } = useGameLinkMutations(datId);
  const [linking, setLinking] = useState<{ fileName: string; crc: string } | null>(null);
  const { data: games = [] } = useQuery({
    queryKey: queryKeys.games(datId),
    queryFn: () => fetchGames(datId),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const canLink = linkableGames(games).length > 0;

  const openDialog = (file: UnmatchedFile) => {
    if (file.crc === undefined) return;
    attach.reset();
    setLinking({ fileName: fileNameOf(file.filePath), crc: file.crc });
  };

  return (
    <>
      {linked.length > 0 && (
        <Foldable
          id={sectionId('linked')}
          open={openSections.linked}
          onOpenChange={(open) => onOpenChange('linked', open)}
          summary={`${linked.length} ${plural(linked.length, 'fichier')} ${plural(linked.length, 'rattaché')} à un jeu`}
        >
          <ul className={css({ pl: '4', display: 'flex', flexDirection: 'column', gap: '1' })}>
            {linked.map(({ filePath, crc, link }) => {
              const isOrphan = link.gameId === null;
              return (
                <li key={filePath} className={rowClass}>
                  <span className={pathClass}>{displayPath(filePath, romsRoot)}</span>
                  <span className={css({ fontSize: 'xs', color: 'fg.default' })}>
                    → {link.gameName}
                    {isOrphan && ' (absent de ce DAT)'}
                  </span>
                  <button
                    type="button"
                    className={linkButtonClass}
                    disabled={detach.isPending}
                    onClick={() => detach.mutate(crc)}
                    aria-label={`Détacher ${fileNameOf(filePath)}`}
                  >
                    Détacher
                  </button>
                </li>
              );
            })}
          </ul>
          {detach.error !== null && (
            <p role="alert" className={css({ color: 'status.danger.text' })}>
              {detach.error.message}
            </p>
          )}
        </Foldable>
      )}

      {unlinked.length > 0 && (
        <Foldable
          id={sectionId('unmatched')}
          open={openSections.unmatched}
          onOpenChange={(open) => onOpenChange('unmatched', open)}
          summary={`${unlinked.length} ${plural(unlinked.length, 'fichier')} ${plural(unlinked.length, 'absent')} du DAT`}
        >
          <p className={css({ fontSize: 'xs', color: 'fg.faint', mb: '2' })}>
            Souvent une autre version (région, langue) d&apos;un jeu du DAT.
            {canLink && ' Rattache-la pour qu’il compte comme possédé.'}
          </p>
          <ul className={css({ pl: '4', display: 'flex', flexDirection: 'column', gap: '1' })}>
            {unlinked.map((file) => (
              <li key={file.filePath} className={rowClass}>
                <span className={pathClass}>{displayPath(file.filePath, romsRoot)}</span>
                {canLink && file.crc !== undefined && (
                  <button
                    type="button"
                    className={linkButtonClass}
                    onClick={() => openDialog(file)}
                    aria-label={`Rattacher ${fileNameOf(file.filePath)}`}
                  >
                    Rattacher
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Foldable>
      )}

      {linking !== null && (
        <LinkGameDialog
          fileName={linking.fileName}
          games={games}
          saving={attach.isPending}
          error={attach.error?.message ?? null}
          onClose={() => setLinking(null)}
          onConfirm={(gameId) =>
            attach.mutate({ fileCrc: linking.crc, gameId }, { onSuccess: () => setLinking(null) })
          }
        />
      )}
    </>
  );
}
