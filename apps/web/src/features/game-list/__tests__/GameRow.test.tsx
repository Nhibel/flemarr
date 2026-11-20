import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Game } from '@shared/dat.js';
import { GameRow } from '../GameRow.js';

const GAME: Game = {
  id: 'smw',
  name: 'super Mario World (USA)',
  region: ['USA', 'Europe'],
  languages: [],
  category: 'Game',
  roms: [
    { name: 'disc1.bin', size: 1_048_576, crc: 'aabbccdd', status: 'good' },
    { name: 'disc2.bin', size: 1_048_576, crc: 'eeff0011', status: 'good' },
  ],
};

function renderRow(over: Partial<ComponentProps<typeof GameRow>> = {}) {
  return render(
    <GameRow game={GAME} isSelected={false} isFocused={false} onToggle={() => {}} {...over} />,
  );
}

describe('GameRow', () => {
  it('toggles the game by its id when clicked', async () => {
    const onToggle = vi.fn();
    renderRow({ onToggle });
    await userEvent.click(screen.getByRole('option'));
    expect(onToggle).toHaveBeenCalledWith('smw');
  });

  it('exposes the selection to assistive tech and in the checkbox', () => {
    const { container } = renderRow({ isSelected: true });
    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true');
    expect(container.querySelector('input[type="checkbox"]')).toBeChecked();
  });

  it('marks the keyboard-focused row', () => {
    renderRow({ isFocused: true });
    expect(screen.getByRole('option')).toHaveAttribute('data-focused', 'true');
  });

  it('shows regions and the total size of every ROM under the name', () => {
    renderRow();
    expect(screen.getByText('USA/Europe · 2.0 MB')).toBeInTheDocument();
  });

  it('shows the boxart when one is known', () => {
    const { container } = renderRow({ boxartSrc: '/api/boxart/smw' });
    expect(container.querySelector('img')).toHaveAttribute('src', '/api/boxart/smw');
  });

  it("falls back to the title's initial without boxart", () => {
    const { container } = renderRow();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('shows the ownership tag from the last scan', () => {
    renderRow({ ownership: 'wrongName' });
    expect(screen.getByText('Mal nommé')).toBeInTheDocument();
  });

  // No scan, no claim: an absent tag must not read as "missing".
  it('shows no tag at all when no scan has run', () => {
    renderRow();
    expect(screen.queryByText('Manquant')).not.toBeInTheDocument();
    expect(screen.queryByText('Sur ton disque')).not.toBeInTheDocument();
  });

  describe('compact mode', () => {
    it('drops the art slot and the tag, and lists regions separately', () => {
      const { container } = renderRow({
        mode: 'compact',
        boxartSrc: '/api/boxart/smw',
        ownership: 'owned',
      });
      expect(container.querySelector('img')).toBeNull();
      expect(screen.queryByText('Sur ton disque')).not.toBeInTheDocument();
      expect(screen.getByText('USA')).toBeInTheDocument();
      expect(screen.getByText('Europe')).toBeInTheDocument();
      expect(screen.getByText('2.0 MB')).toBeInTheDocument();
    });
  });
});
