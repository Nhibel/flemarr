import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GameList } from './GameList.js';
import { fetchGameDetails } from '@/lib/api.js';
import type { Game } from '@shared/dat.js';

vi.mock('@/lib/api.js', () => ({
  fetchGameDetails: vi.fn(),
  gameBoxartUrl: (datId: string, gameId: string) => `/api/dats/${datId}/games/${gameId}/boxart`,
}));

const fetchGameDetailsMock = vi.mocked(fetchGameDetails);

beforeEach(() => {
  fetchGameDetailsMock.mockReset();
  fetchGameDetailsMock.mockResolvedValue({ details: [] });
});

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

function renderList(games: Game[], onToggle = vi.fn(), selected = new Set<string>()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GameList datId="dat-1" games={games} selected={selected} onToggle={onToggle} />
    </QueryClientProvider>,
  );
}

describe('GameList', () => {
  it('renders all games when they fit on one page, without pagination controls', () => {
    renderList(GAMES);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
  });

  it('shows empty state when no games', () => {
    renderList([]);
    expect(screen.getByText(/no games match/i)).toBeInTheDocument();
  });

  it('calls onToggle when a row is clicked', async () => {
    const onToggle = vi.fn();
    renderList(GAMES, onToggle);
    await userEvent.click(screen.getByText('Beta'));
    expect(onToggle).toHaveBeenCalledWith('b');
  });

  it('ArrowDown moves focus to next row and Space toggles it', async () => {
    const onToggle = vi.fn();
    renderList(GAMES, onToggle);

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
    renderList(GAMES, onToggle);

    const listbox = screen.getByRole('listbox');
    await userEvent.click(listbox);
    // focus initialises on index 0 (Alpha); ArrowUp should keep it at 0
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard(' ');
    expect(onToggle).toHaveBeenCalledWith('a');
  });

  it('paginates at 50 per page with a range indicator', () => {
    renderList(MANY);
    expect(screen.getByText('Game 00')).toBeInTheDocument();
    expect(screen.getByText('Game 49')).toBeInTheDocument();
    expect(screen.queryByText('Game 50')).not.toBeInTheDocument();
    expect(screen.getByText(/1–50 of 60/)).toBeInTheDocument();
  });

  it('Next shows the following page, Prev returns', async () => {
    renderList(MANY);

    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Game 50')).toBeInTheDocument();
    expect(screen.queryByText('Game 00')).not.toBeInTheDocument();
    expect(screen.getByText(/51–60 of 60/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /prev/i }));
    expect(screen.getByText('Game 00')).toBeInTheDocument();
  });

  it('ArrowDown at the last row of a page crosses to the next page', async () => {
    const onToggle = vi.fn();
    renderList(MANY, onToggle);

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
    renderList(MANY, onToggle);

    const listbox = screen.getByRole('listbox');
    await userEvent.click(listbox);
    for (let i = 0; i < 50; i++) await userEvent.keyboard('{ArrowDown}');
    // on page 2 row 0 — ArrowUp goes back to page 1, last row (Game 49)
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard(' ');
    expect(onToggle).toHaveBeenCalledWith('g49');
    expect(screen.getByText(/1–50 of 60/)).toBeInTheDocument();
  });

  it('compact mode issues no details request and hides boxart slots', async () => {
    localStorage.setItem('rom-curator.display-mode', 'compact');
    try {
      const { container } = renderList(GAMES);
      expect(screen.getByRole('button', { name: 'Compact' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      // no fetch, no boxart slot at all in compact rows
      await new Promise((r) => setTimeout(r, 50));
      expect(fetchGameDetailsMock).not.toHaveBeenCalled();
      expect(container.querySelector('img')).toBeNull();
    } finally {
      localStorage.removeItem('rom-curator.display-mode');
    }
  });

  it('switching modes persists and re-enables the details query', async () => {
    renderList(GAMES);
    await userEvent.click(screen.getByRole('button', { name: 'Detailed' }));
    expect(localStorage.getItem('rom-curator.display-mode')).toBe('detailed');
    expect(screen.getAllByText('Pas de descriptif').length).toBeGreaterThan(0);
    localStorage.removeItem('rom-curator.display-mode');
  });

  it('detailed mode shows description, year, genre and publisher when known', async () => {
    localStorage.setItem('rom-curator.display-mode', 'detailed');
    fetchGameDetailsMock.mockResolvedValue({
      details: [
        {
          gameId: 'a',
          hasBoxart: false,
          description: 'Des blocs tombent.',
          year: 1989,
          genre: 'Puzzle',
          publisher: 'Nintendo',
        },
      ],
    });
    try {
      renderList(GAMES);
      await waitFor(() => {
        expect(screen.getByText('Des blocs tombent.')).toBeInTheDocument();
        expect(screen.getByText('1989 · Puzzle · Nintendo')).toBeInTheDocument();
      });
      // games without info keep the placeholder
      expect(screen.getAllByText('Pas de descriptif')).toHaveLength(2);
    } finally {
      localStorage.removeItem('rom-curator.display-mode');
    }
  });

  it('requests details for the displayed page and shows boxarts', async () => {
    fetchGameDetailsMock.mockResolvedValue({
      details: [
        { gameId: 'a', hasBoxart: true },
        { gameId: 'b', hasBoxart: false },
      ],
    });
    const { container } = renderList(GAMES);

    await waitFor(() => {
      const img = container.querySelector('img');
      expect(img).not.toBeNull();
      expect(img?.getAttribute('src')).toBe('/api/dats/dat-1/games/a/boxart');
    });
    // one img for the found boxart only; the others show placeholders
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(fetchGameDetailsMock).toHaveBeenCalledWith('dat-1', ['a', 'b', 'c']);
  });
});
