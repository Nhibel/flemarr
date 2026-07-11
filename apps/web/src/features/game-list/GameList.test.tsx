import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameList } from './GameList.js';
import type { Game } from '@shared/dat.js';

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

// 60 games → two pages of 50/10 with the fixed page size.
const MANY = Array.from({ length: 60 }, (_, i) =>
  makeGame(`g${i}`, `Game ${String(i).padStart(2, '0')}`),
);

describe('GameList', () => {
  it('renders all games when they fit on one page, without pagination controls', () => {
    render(<GameList games={GAMES} selected={new Set()} onToggle={vi.fn()} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
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

  it('ArrowUp does not go below index 0 on the first page', async () => {
    const onToggle = vi.fn();
    render(<GameList games={GAMES} selected={new Set()} onToggle={onToggle} />);

    const listbox = screen.getByRole('listbox');
    await userEvent.click(listbox);
    // focus initialises on index 0 (Alpha); ArrowUp should keep it at 0
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard(' ');
    expect(onToggle).toHaveBeenCalledWith('a');
  });

  it('paginates at 50 per page with a range indicator', () => {
    render(<GameList games={MANY} selected={new Set()} onToggle={vi.fn()} />);
    expect(screen.getByText('Game 00')).toBeInTheDocument();
    expect(screen.getByText('Game 49')).toBeInTheDocument();
    expect(screen.queryByText('Game 50')).not.toBeInTheDocument();
    expect(screen.getByText(/1–50 of 60/)).toBeInTheDocument();
  });

  it('Next shows the following page, Prev returns', async () => {
    render(<GameList games={MANY} selected={new Set()} onToggle={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Game 50')).toBeInTheDocument();
    expect(screen.queryByText('Game 00')).not.toBeInTheDocument();
    expect(screen.getByText(/51–60 of 60/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /prev/i }));
    expect(screen.getByText('Game 00')).toBeInTheDocument();
  });

  it('ArrowDown at the last row of a page crosses to the next page', async () => {
    const onToggle = vi.fn();
    render(<GameList games={MANY} selected={new Set()} onToggle={onToggle} />);

    const listbox = screen.getByRole('listbox');
    await userEvent.click(listbox);
    // walk from row 0 to the last row of page 1, then one more
    for (let i = 0; i < 50; i++) await userEvent.keyboard('{ArrowDown}');
    // now on page 2, focused on its first row (Game 50)
    await userEvent.keyboard(' ');
    expect(onToggle).toHaveBeenCalledWith('g50');
    expect(screen.getByText(/51–60 of 60/)).toBeInTheDocument();
  });

  it('ArrowUp at the first row of page 2 returns to the last row of page 1', async () => {
    const onToggle = vi.fn();
    render(<GameList games={MANY} selected={new Set()} onToggle={onToggle} />);

    const listbox = screen.getByRole('listbox');
    await userEvent.click(listbox);
    for (let i = 0; i < 50; i++) await userEvent.keyboard('{ArrowDown}');
    // on page 2 row 0 — ArrowUp goes back to page 1, last row (Game 49)
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard(' ');
    expect(onToggle).toHaveBeenCalledWith('g49');
    expect(screen.getByText(/1–50 of 60/)).toBeInTheDocument();
  });
});
