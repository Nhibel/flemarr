import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameFilters } from './GameFilters.js';
import type { FilterState } from './use-game-filters.js';

// The filters were three permanently expanded rows of chips; they are now a
// single row whose region/category/sort values live inside <details> menus.
// These cover the behaviour that restructuring could silently have broken —
// the chips are still multi-select, and the new segmented control must not
// toggle when the already-active side is pressed.

function baseState(over: Partial<FilterState> = {}): FilterState {
  return { search: '', regions: [], categories: [], sortBy: 'name', sortDir: 'asc', ...over };
}

function setup(over: Partial<React.ComponentProps<typeof GameFilters>> = {}) {
  const props = {
    filterState: baseState(),
    totalCount: 100,
    filteredCount: 42,
    selectedOnly: false,
    selectedCount: 7,
    onToggleSelectedOnly: vi.fn(),
    onToggleRegion: vi.fn(),
    onToggleCategory: vi.fn(),
    onSetSortBy: vi.fn(),
    onToggleSortDir: vi.fn(),
    onSelectAll: vi.fn(),
    onClearAll: vi.fn(),
    isAllSelected: false,
    ...over,
  };
  render(<GameFilters {...props} />);
  return props;
}

describe('GameFilters', () => {
  it('regions stay multi-select inside the menu', async () => {
    const user = userEvent.setup();
    const props = setup();

    // Scoped to the <summary>: "Région" is also one of the sort options,
    // and a <details> keeps its contents in the DOM when closed.
    await user.click(screen.getByText('Région', { selector: 'summary' }));
    await user.click(screen.getByRole('button', { name: 'Europe' }));
    await user.click(screen.getByRole('button', { name: 'USA' }));

    expect(props.onToggleRegion).toHaveBeenNthCalledWith(1, 'Europe');
    expect(props.onToggleRegion).toHaveBeenNthCalledWith(2, 'USA');
  });

  it('a closed menu still reports how many of its values are active', () => {
    setup({ filterState: baseState({ regions: ['Europe', 'USA'] }) });
    // The count badge sits inside the <summary>, so it is readable without
    // opening the menu — the point of collapsing the rows was not to hide
    // active filters.
    expect(screen.getByText('Région', { selector: 'summary' }).textContent).toContain('2');
  });

  it('the segmented control only toggles when the other side is pressed', async () => {
    const user = userEvent.setup();
    const props = setup({ selectedOnly: false });

    // "Tout" is already active: pressing it must be a no-op, not a toggle
    // back to the selection-only view.
    await user.click(screen.getByRole('button', { name: 'Tout' }));
    expect(props.onToggleSelectedOnly).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Ma sélection/ }));
    expect(props.onToggleSelectedOnly).toHaveBeenCalledTimes(1);
  });

  it('sorting by a field and flipping the direction are separate actions', async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.click(screen.getByText(/^Tri/, { selector: 'summary' }));
    await user.click(screen.getByRole('button', { name: 'Taille' }));
    await user.click(screen.getByRole('button', { name: 'Tri décroissant' }));

    expect(props.onSetSortBy).toHaveBeenCalledWith('size');
    expect(props.onToggleSortDir).toHaveBeenCalledTimes(1);
  });

  it('shows the filtered and total counts', () => {
    setup();
    expect(screen.getByText('42 / 100')).toBeInTheDocument();
  });
});
