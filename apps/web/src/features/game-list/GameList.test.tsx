import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameList } from './GameList.js';
import type { Game } from '@shared/dat.js';

// @tanstack/react-virtual needs a real layout engine (ResizeObserver + getBoundingClientRect).
// jsdom has neither. Mock the virtualizer so all items are always rendered,
// which lets us test our integration code without fighting jsdom's layout limits.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (opts: { count: number; estimateSize: () => number; overscan?: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: opts.count }, (_, i) => ({
        index: i,
        key: String(i),
        start: i * opts.estimateSize(),
        size: opts.estimateSize(),
      })),
    getTotalSize: () => opts.count * opts.estimateSize(),
    scrollToIndex: vi.fn(),
  }),
}));

function makeGame(id: string, name: string): Game {
  return {
    id,
    name,
    region: ['USA'],
    languages: [],
    category: 'Game',
    roms: [{ name: 'r.sfc', size: 1024, crc: 'aabbccdd', status: 'good' }],
  };
}

const GAMES = [makeGame('a', 'Alpha'), makeGame('b', 'Beta'), makeGame('c', 'Gamma')];

describe('GameList', () => {
  it('renders all games', () => {
    render(<GameList games={GAMES} selected={new Set()} onToggle={vi.fn()} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('shows empty state when no games', () => {
    render(<GameList games={[]} selected={new Set()} onToggle={vi.fn()} />);
    expect(screen.getByText(/no games match/i)).toBeInTheDocument();
  });

  it('calls onToggle when a row is clicked', async () => {
    const onToggle = vi.fn();
    render(<GameList games={GAMES} selected={new Set()} onToggle={onToggle} />);
    await userEvent.click(screen.getByText('Beta'));
    expect(onToggle).toHaveBeenCalledWith('b');
  });

  it('ArrowDown moves focus to next row and Space toggles it', async () => {
    const onToggle = vi.fn();
    render(<GameList games={GAMES} selected={new Set()} onToggle={onToggle} />);

    const listbox = screen.getByRole('listbox');
    await userEvent.click(listbox);
    // focus initialises on index 0 (Alpha)
    await userEvent.keyboard('{ArrowDown}');
    // focus is now on index 1 (Beta)
    await userEvent.keyboard(' ');
    expect(onToggle).toHaveBeenCalledWith('b');
  });

  it('ArrowUp does not go below index 0', async () => {
    const onToggle = vi.fn();
    render(<GameList games={GAMES} selected={new Set()} onToggle={onToggle} />);

    const listbox = screen.getByRole('listbox');
    await userEvent.click(listbox);
    // focus initialises on index 0 (Alpha); ArrowUp should keep it at 0
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard(' ');
    expect(onToggle).toHaveBeenCalledWith('a');
  });
});
