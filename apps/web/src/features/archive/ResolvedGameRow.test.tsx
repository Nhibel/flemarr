import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ResolvedGame, ResolvedSource } from '@shared/archive.js';
import { ResolvedGameRow } from './ResolvedGameRow.js';

function source(identifier: string, verified = true): ResolvedSource {
  return {
    identifier,
    container: 'direct',
    extractFromZip: false,
    downloadUrl: `https://archive.org/download/${identifier}/rom`,
    verified,
  };
}

function game(roms: { romName: string; sources: ResolvedSource[] }[]): ResolvedGame {
  return {
    gameId: 'g1',
    gameName: 'Final Fantasy VII (USA)',
    roms: roms.map((rom) => ({ ...rom, expectedCrc: 'aabbccdd' })),
  };
}

function renderRow(
  resolved: ResolvedGame,
  selectedSourceIndex = new Map<string, number>(),
  onSelectSource = vi.fn(),
) {
  render(
    <ResolvedGameRow
      game={resolved}
      selectedSourceIndex={selectedSourceIndex}
      onSelectSource={onSelectSource}
    />,
  );
  return { onSelectSource };
}

describe('ResolvedGameRow', () => {
  it('names the source each ROM will come from', () => {
    renderRow(game([{ romName: 'ff7.bin', sources: [source('psx-set')] }]));
    expect(screen.getByText('Final Fantasy VII (USA)')).toBeInTheDocument();
    expect(screen.getByText('✓ ff7.bin — [direct] psx-set')).toBeInTheDocument();
  });

  it('warns when a match rests on the name alone', () => {
    renderRow(game([{ romName: 'ff7.bin', sources: [source('psx-set', false)] }]));
    expect(
      screen.getByText('⚠ ff7.bin — [direct] psx-set (nom seul, CRC non confirmé)'),
    ).toBeInTheDocument();
  });

  it('says when no source has the game', () => {
    renderRow(game([{ romName: 'ff7.bin', sources: [] }]));
    expect(screen.getByText('Non trouvé dans les sources configurées')).toBeInTheDocument();
  });

  it('counts the discs found for a multi-disc game, and lists the missing one', () => {
    renderRow(
      game([
        { romName: 'disc1.bin', sources: [source('psx-set')] },
        { romName: 'disc2.bin', sources: [] },
      ]),
    );
    expect(screen.getByText(/1\/2 disques/)).toBeInTheDocument();
    expect(screen.getByText('— disc2.bin — introuvable')).toBeInTheDocument();
  });

  it('offers no picker when a ROM has a single source', () => {
    renderRow(game([{ romName: 'ff7.bin', sources: [source('psx-set')] }]));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('lets the user pick between sources, and reports the pick', async () => {
    const { onSelectSource } = renderRow(
      game([{ romName: 'ff7.bin', sources: [source('psx-set'), source('psx-alt')] }]),
    );
    await userEvent.click(screen.getByRole('button', { name: 'psx-alt' }));
    expect(onSelectSource).toHaveBeenCalledWith('g1', 'ff7.bin', 1);
  });

  it('describes the picked source, not the first', () => {
    renderRow(
      game([{ romName: 'ff7.bin', sources: [source('psx-set'), source('psx-alt')] }]),
      new Map([['g1/ff7.bin', 1]]),
    );
    expect(screen.getByText('✓ ff7.bin — [direct] psx-alt')).toBeInTheDocument();
  });
});
