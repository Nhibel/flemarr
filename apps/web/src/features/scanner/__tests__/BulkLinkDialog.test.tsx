import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Game } from '@shared/dat.js';
import { BulkLinkDialog } from '../BulkLinkDialog.js';
import type { LinkProposal } from '../bulk-links.js';

function game(name: string): Game {
  return { id: name, name, region: [], languages: [], roms: [{ name, size: 1, status: 'good' }] };
}

const METROID: LinkProposal = {
  filePath: '/roms/Metroid.nes',
  fileName: 'Metroid.nes',
  crc: '00000001',
  candidates: [game('Metroid (USA)')],
  gameId: 'Metroid (USA)',
  checked: true,
};
const TETRIS: LinkProposal = {
  filePath: '/roms/Tetris.nes',
  fileName: 'Tetris.nes',
  crc: '00000002',
  candidates: [game('Tetris (Japan)'), game('Tetris (USA)')],
  gameId: 'Tetris (Japan)',
  checked: false,
};
const UNKNOWN: LinkProposal = {
  filePath: '/roms/Hack.nes',
  fileName: 'Hack.nes',
  crc: '00000003',
  candidates: [],
  gameId: null,
  checked: false,
};

function renderDialog(overrides: Partial<Parameters<typeof BulkLinkDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  render(
    <BulkLinkDialog
      proposals={[METROID, TETRIS, UNKNOWN]}
      saving={false}
      error={null}
      onConfirm={onConfirm}
      onClose={() => {}}
      {...overrides}
    />,
  );
  return { onConfirm };
}

const confirmButton = () => screen.getByRole('button', { name: /^Rattacher \d/, hidden: true });

describe('BulkLinkDialog', () => {
  it('saves only the ticked files, once confirmed', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();
    expect(confirmButton()).toHaveTextContent('Rattacher 1 fichier');
    await user.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith([{ fileCrc: '00000001', gameId: 'Metroid (USA)' }]);
  });

  it('lets the user tick a file and pick another game for it', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();
    await user.selectOptions(screen.getByLabelText('Jeu pour Tetris.nes'), 'Tetris (USA)');
    await user.click(screen.getByRole('checkbox', { name: 'Tetris.nes', hidden: true }));
    await user.click(screen.getByRole('checkbox', { name: 'Metroid.nes', hidden: true }));
    await user.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith([{ fileCrc: '00000002', gameId: 'Tetris (USA)' }]);
  });

  it('offers nothing to tick for a file without a proposal', () => {
    renderDialog();
    expect(screen.getByRole('checkbox', { name: 'Hack.nes', hidden: true })).toBeDisabled();
    expect(screen.getByText('Aucun titre proche')).toBeInTheDocument();
  });

  it('cannot save while nothing is ticked, nor while saving', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('checkbox', { name: 'Metroid.nes', hidden: true }));
    expect(confirmButton()).toBeDisabled();
  });

  it('says why saving failed', () => {
    renderDialog({ error: 'refusé', saving: false });
    expect(screen.getByRole('alert', { hidden: true })).toHaveTextContent('refusé');
  });
});
