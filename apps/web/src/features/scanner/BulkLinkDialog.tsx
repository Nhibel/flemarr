import { useState } from 'react';
import { css, cx } from '@/styled-system/css';
import { Button } from '@/components/Button.js';
import { Dialog } from '@/components/Dialog.js';
import { inputClass } from '@/features/settings/styles.js';
import { plural } from '@/lib/plural.js';
import type { LinkProposal } from './bulk-links.js';

interface Choice {
  checked: boolean;
  gameId: string | null;
}

interface Props {
  proposals: LinkProposal[];
  saving: boolean;
  error: string | null;
  onConfirm: (links: { fileCrc: string; gameId: string }[]) => void;
  onClose: () => void;
}

const rowClass = css({
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  columnGap: '3',
  rowGap: '1',
  alignItems: 'center',
  py: '2',
});

function initialChoices(proposals: LinkProposal[]): Map<string, Choice> {
  return new Map(proposals.map((p) => [p.filePath, { checked: p.checked, gameId: p.gameId }]));
}

/** Attaches many files at once. Only the ticked rows are saved, once confirmed. */
export function BulkLinkDialog({ proposals, saving, error, onConfirm, onClose }: Props) {
  const [choices, setChoices] = useState(() => initialChoices(proposals));

  const update = (filePath: string, change: Partial<Choice>) => {
    setChoices((previous) => {
      const next = new Map(previous);
      const current = next.get(filePath) ?? { checked: false, gameId: null };
      next.set(filePath, { ...current, ...change });
      return next;
    });
  };

  const links = proposals.flatMap((proposal) => {
    const choice = choices.get(proposal.filePath);
    if (choice?.checked !== true || choice.gameId === null) return [];
    return [{ fileCrc: proposal.crc, gameId: choice.gameId }];
  });

  return (
    <Dialog open onClose={onClose} title="Tout rattacher">
      <p className={css({ fontSize: 'sm', color: 'fg.subtle' })}>
        Cochés d’office : même titre qu’un seul jeu, pas encore possédé. Vérifie les autres : seul
        le titre est comparé, pas le contenu. Les fichiers ne sont pas renommés.
      </p>
      <ul className={css({ overflowY: 'auto', display: 'flex', flexDirection: 'column' })}>
        {proposals.map((proposal) => {
          const choice = choices.get(proposal.filePath);
          const hasCandidates = proposal.candidates.length > 0;
          return (
            <li key={proposal.filePath} className={rowClass}>
              <input
                type="checkbox"
                id={`bulk-${proposal.crc}`}
                checked={choice?.checked === true}
                disabled={!hasCandidates}
                onChange={(e) => update(proposal.filePath, { checked: e.target.checked })}
              />
              <label
                htmlFor={`bulk-${proposal.crc}`}
                className={css({ fontFamily: 'mono', fontSize: 'xs', overflowWrap: 'anywhere' })}
              >
                {proposal.fileName}
              </label>
              <span />
              {hasCandidates ? (
                <select
                  aria-label={`Jeu pour ${proposal.fileName}`}
                  value={choice?.gameId ?? ''}
                  onChange={(e) => update(proposal.filePath, { gameId: e.target.value })}
                  className={cx(inputClass, css({ w: 'full', fontSize: 'sm' }))}
                >
                  {proposal.candidates.map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={css({ fontSize: 'xs', color: 'fg.faint' })}>
                  Aucun titre proche
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {error !== null && (
        <p role="alert" className={css({ fontSize: 'sm', color: 'status.danger.text' })}>
          {error}
        </p>
      )}
      <Button disabled={links.length === 0 || saving} onClick={() => onConfirm(links)}>
        {`Rattacher ${links.length} ${plural(links.length, 'fichier')}`}
      </Button>
    </Dialog>
  );
}
