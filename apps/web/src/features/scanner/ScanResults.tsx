import { css } from '@/styled-system/css';
import { Chip } from '@/components/Chip.js';
import { Foldable } from '@/components/Foldable.js';
import { useGameLinks } from '@/lib/use-game-links.js';
import type { ScanResult } from '@shared/scan.js';
import { RenameRow } from './RenameRow.js';
import { UnmatchedFiles } from './UnmatchedFiles.js';
import { plural } from '@/lib/plural.js';
import { chosenName } from './use-renames.js';
import { sectionId, useOpenSections } from './use-open-sections.js';
import type { ScanSection } from './use-open-sections.js';
import { foundGames, ownedGameNames, scannedFileCount, splitUnmatched } from './scan-summary.js';

interface ScanResultsProps {
  datId: string;
  result: ScanResult;
  selected: Set<string>;
  /** Names picked for the files several games share, by path. */
  choices: ReadonlyMap<string, string>;
  onToggle: (p: string) => void;
  onChoose: (filePath: string, name: string) => void;
  /** Selects every misnamed file (true) or none (false). */
  onSetAll: (selectAll: boolean) => void;
  onRename: () => void;
  renaming: boolean;
}

/** The scan's outcome: counts, the misnamed files to rename, and what matched nothing. */
export function ScanResults({
  datId,
  result,
  selected,
  choices,
  onToggle,
  onChoose,
  onSetAll,
  onRename,
  renaming,
}: ScanResultsProps) {
  const { wrongName } = result;
  const { linked, unlinked } = splitUnmatched(result.unmatched, useGameLinks(datId));
  const { openSections, setOpen } = useOpenSections();
  const total = scannedFileCount(result);
  const games = foundGames(result);
  // A file whose name is still to be picked cannot be selected.
  const selectable = wrongName.filter((entry) => chosenName(entry, choices) !== undefined);
  const allSelected =
    selectable.length > 0 && selectable.every((entry) => selected.has(entry.filePath));

  const toggleOf = (section: ScanSection, count: number) => {
    if (count === 0) return undefined;
    const open = openSections[section];
    return { open, controls: sectionId(section), onToggle: () => setOpen(section, !open) };
  };

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
      {/* Summary chips. Found counts games; the others count files,
          since those are files to act on. Each folds its list. */}
      <div className={css({ display: 'flex', gap: '3', flexWrap: 'wrap' })}>
        <Chip
          label={`${plural(games.length, 'jeu', 'jeux')} ${plural(games.length, 'trouvé')}`}
          count={games.length}
          color="green"
          toggle={toggleOf('found', games.length)}
        />
        <Chip
          label={plural(wrongName.length, 'mal nommé')}
          count={wrongName.length}
          color="amber"
          toggle={toggleOf('wrongName', wrongName.length)}
        />
        {linked.length > 0 && (
          <Chip
            label={plural(linked.length, 'rattaché')}
            count={linked.length}
            color="blue"
            toggle={toggleOf('linked', linked.length)}
          />
        )}
        <Chip
          label={`${plural(unlinked.length, 'absent')} du DAT`}
          count={unlinked.length}
          color="gray"
          toggle={toggleOf('unmatched', unlinked.length)}
        />
        <span className={css({ fontSize: 'xs', color: 'fg.faint', alignSelf: 'center' })}>
          {total} {plural(total, 'fichier')} {plural(total, 'scanné')}
        </span>
      </div>

      {/* Rename suggestions */}
      {wrongName.length > 0 && (
        <Foldable
          id={sectionId('wrongName')}
          open={openSections.wrongName}
          onOpenChange={(open) => setOpen('wrongName', open)}
          summary="Suggestions de renommage"
        >
          <div className={css({ mb: '2' })}>
            <button
              onClick={() => onSetAll(!allSelected)}
              className={css({
                fontSize: 'xs',
                color: 'accent.text',
                cursor: 'pointer',
                _hover: { textDecoration: 'underline' },
              })}
            >
              {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          </div>
          <div
            className={css({
              borderRadius: 'xl',
              overflow: 'hidden',
            })}
          >
            {wrongName.map((entry) => (
              <RenameRow
                key={entry.filePath}
                entry={entry}
                checked={selected.has(entry.filePath)}
                choice={choices.get(entry.filePath)}
                onToggle={onToggle}
                onChoose={onChoose}
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
          </div>
        </Foldable>
      )}

      <UnmatchedFiles
        datId={datId}
        linked={linked}
        unlinked={unlinked}
        ownedGameNames={ownedGameNames(result, linked)}
        openSections={openSections}
        onOpenChange={setOpen}
      />

      {/* Found games — folded: on a full folder it is the long list, and
          not the one that asks for action. */}
      {games.length > 0 && (
        <Foldable
          id={sectionId('found')}
          open={openSections.found}
          onOpenChange={(open) => setOpen('found', open)}
          summary={`Voir ${plural(games.length, 'le jeu trouvé', `les ${games.length} jeux trouvés`)}`}
        >
          <ul
            className={css({
              pl: '4',
              mt: '1',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5',
            })}
          >
            {games.map((name) => (
              <li
                key={name}
                className={css({ color: 'fg.default', fontSize: 'xs', truncate: true })}
              >
                {name}
              </li>
            ))}
          </ul>
        </Foldable>
      )}
    </div>
  );
}
