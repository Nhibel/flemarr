import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GameList } from './GameList.js';
import { fetchGameDetails } from '@/lib/api.js';
import type { Game } from '@shared/dat.js';
import type { Ownership } from '@/lib/missing-games.js';

vi.mock('@/lib/api.js', () => ({
  fetchGameDetails: vi.fn(),
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
      <GameList
        datId="dat-1"
        games={games}
        selected={selected}
        onToggle={onToggle}
        search=""
        onSearch={vi.fn()}
        totalGames={games.length}
      />
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
    expect(screen.getByText(/aucun jeu ne correspond/i)).toBeInTheDocument();
  });

  it('calls onToggle when a row is clicked', async () => {
    const onToggle = vi.fn();
    renderList(GAMES, onToggle);
    await userEvent.click(screen.getByText('Beta'));
    expect(onToggle).toHaveBeenCalledWith('b');
  });

  it('clicking a row focuses that row, not row 0 (regression: clicking moved focus to the listbox container, not the row, so the next keyboard move always acted as if row 0 were focused)', async () => {
    const onToggle = vi.fn();
    renderList(GAMES, onToggle);

    // First interaction of the page — focusedIndex starts at -1, same state
    // as right after a page change via Suivant/Précédent.
    await userEvent.click(screen.getByText('Gamma'));
    expect(onToggle).toHaveBeenCalledWith('c');

    onToggle.mockClear();
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.keyboard(' ');
    // Focus should have moved from Gamma (index 2) up to Beta (index 1).
    // Before the fix, the click left focus on index 0 (Alpha) regardless
    // of which row was clicked, so ArrowUp (already at the floor) stayed
    // on Alpha and this would fire with 'a' instead.
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
    expect(screen.getByText(/1–50 sur 60/)).toBeInTheDocument();
  });

  it('Next shows the following page, Prev returns', async () => {
    renderList(MANY);

    await userEvent.click(screen.getByRole('button', { name: /suivant/i }));
    expect(screen.getByText('Game 50')).toBeInTheDocument();
    expect(screen.queryByText('Game 00')).not.toBeInTheDocument();
    expect(screen.getByText(/51–60 sur 60/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /précédent/i }));
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
    expect(screen.getByText(/51–60 sur 60/)).toBeInTheDocument();
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
    expect(screen.getByText(/1–50 sur 60/)).toBeInTheDocument();
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

  it('switching modes persists the choice', async () => {
    renderList(GAMES);
    await userEvent.click(screen.getByRole('button', { name: 'Compact' }));
    expect(localStorage.getItem('rom-curator.display-mode')).toBe('compact');
    localStorage.removeItem('rom-curator.display-mode');
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

describe('GameList — ownership tags', () => {
  function renderWithOwnership(ownership?: Map<string, Ownership>) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <GameList
          datId="dat-1"
          games={GAMES}
          selected={new Set<string>()}
          onToggle={vi.fn()}
          ownership={ownership}
          search=""
          onSearch={vi.fn()}
          totalGames={GAMES.length}
        />
      </QueryClientProvider>,
    );
  }

  it('gives each row the tag for its own state', () => {
    renderWithOwnership(
      new Map<string, Ownership>([
        ['a', 'owned'],
        ['b', 'wrongName'],
        ['c', 'missing'],
      ]),
    );

    expect(screen.getByText('Sur ton disque')).toBeInTheDocument();
    expect(screen.getByText('Mal nommé')).toBeInTheDocument();
    expect(screen.getByText('Manquant')).toBeInTheDocument();
  });

  // Browser mode and the state before any scan: the app knows nothing about
  // what is on disk, so it must say nothing rather than tag every row
  // "missing" on no evidence.
  it('shows no tag at all when ownership is unknown', () => {
    renderWithOwnership(undefined);
    expect(screen.queryByText('Manquant')).not.toBeInTheDocument();
    expect(screen.queryByText('Sur ton disque')).not.toBeInTheDocument();
  });

  it('shows no tag on a game the ownership map does not cover', () => {
    renderWithOwnership(new Map<string, Ownership>([['a', 'owned']]));
    expect(screen.getByText('Sur ton disque')).toBeInTheDocument();
    expect(screen.queryByText('Manquant')).not.toBeInTheDocument();
  });
});

describe('GameList — search toolbar', () => {
  it('reports what the user types', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <GameList
          datId="dat-1"
          games={GAMES}
          selected={new Set<string>()}
          onToggle={vi.fn()}
          search=""
          onSearch={onSearch}
          totalGames={3}
        />
      </QueryClientProvider>,
    );

    await user.type(screen.getByRole('searchbox'), 'z');
    expect(onSearch).toHaveBeenCalledWith('z');
  });

  // The search box lives on this component's own toolbar, so the empty
  // state must keep the toolbar: a search that filters everything out
  // would otherwise remove the only way to clear it.
  it('keeps the search box when nothing matches', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <GameList
          datId="dat-1"
          games={[]}
          selected={new Set<string>()}
          onToggle={vi.fn()}
          search="zzzz"
          onSearch={vi.fn()}
          totalGames={3}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Aucun jeu ne correspond aux filtres actuels.')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('zzzz');
  });
});

// Regression: pressing a row used to lose the click AND scroll the list
// back to its first row. A row is a plain div, so pressing one moves focus
// to the listbox, whose onFocus fell back to "focus row 0" while nothing
// was focused yet — and the scroll that followed happened before the user
// released the button, so mouseup landed on another row and the click fired
// on the listbox instead of on a row. Claiming the index on pointerdown,
// before the focus moves, is what makes the fallback stay out of the way.
describe('GameList — pressing a row', () => {
  const realScrollIntoView = Element.prototype.scrollIntoView;

  beforeEach(() => {
    // jsdom has no layout and ships no scrollIntoView at all; the component
    // calls it optionally. A stub lets these tests observe the scroll the
    // user actually saw.
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = realScrollIntoView;
  });

  it('claims the pressed row before focus reaches the listbox', () => {
    renderList(GAMES);
    // Scoped to the listbox: the « Par page » select also renders
    // elements with role=option, and they come first in the document.
    const rows = within(screen.getByRole('listbox')).getAllByRole('option');

    // The browser's own order on a press.
    fireEvent.pointerDown(rows[2]!);
    fireEvent.focusIn(screen.getByRole('listbox'));

    expect(rows[2]!).toHaveAttribute('data-focused');
    expect(rows[0]!).not.toHaveAttribute('data-focused');
  });

  it('never scrolls the first row into view because of a press on another', () => {
    renderList(GAMES);
    const rows = within(screen.getByRole('listbox')).getAllByRole('option');
    const scrolled = vi.mocked(Element.prototype.scrollIntoView);

    fireEvent.pointerDown(rows[2]!);
    fireEvent.focusIn(screen.getByRole('listbox'));

    expect(scrolled.mock.instances).not.toContain(rows[0]!);
  });

  // The fallback still has a job: a keyboard user tabbing into the list
  // with nothing focused yet lands on the first row.
  it('still focuses the first row when focus arrives without a press', () => {
    renderList(GAMES);
    fireEvent.focusIn(screen.getByRole('listbox'));
    expect(within(screen.getByRole('listbox')).getAllByRole('option')[0]!).toHaveAttribute(
      'data-focused',
    );
  });
});
