import { css } from '@/styled-system/css';
import type { FilterState, SortBy } from './use-game-filters.js';

const REGIONS = ['Europe', 'USA', 'Japan', 'World'];
const CATEGORIES = ['Game', 'Demo', 'Proto', 'Beta', 'Unl', 'Aftermarket'];
const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'region', label: 'Region' },
  { value: 'size', label: 'Size' },
];

interface Props {
  filterState: FilterState;
  totalCount: number;
  filteredCount: number;
  selectedOnly: boolean;
  selectedCount: number;
  onToggleSelectedOnly: () => void;
  onSearch: (v: string) => void;
  onToggleRegion: (r: string) => void;
  onToggleCategory: (c: string) => void;
  onSetSortBy: (s: SortBy) => void;
  onToggleSortDir: () => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  isAllSelected: boolean;
}

const chipBase = css.raw({
  px: '2',
  py: '1',
  borderRadius: 'full',
  fontSize: 'xs',
  fontWeight: 'medium',
  border: '1px solid',
  cursor: 'pointer',
  transition: 'all 0.1s',
});

export function GameFilters({
  filterState,
  totalCount,
  filteredCount,
  selectedOnly,
  selectedCount,
  onToggleSelectedOnly,
  onSearch,
  onToggleRegion,
  onToggleCategory,
  onSetSortBy,
  onToggleSortDir,
  onSelectAll,
  onClearAll,
  isAllSelected,
}: Props) {
  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '3', pb: '3' })}>
      {/* Search */}
      <input
        type="search"
        placeholder={`Search ${totalCount} games…`}
        value={filterState.search}
        onChange={(e) => onSearch(e.target.value)}
        className={css({
          w: 'full',
          px: '3',
          py: '2',
          border: '1px solid',
          borderColor: 'bd.strong',
          borderRadius: 'md',
          fontSize: 'sm',
          outline: 'none',
          _focusVisible: { borderColor: 'blue.400', ring: '2px', ringColor: 'blue.200' },
        })}
      />

      {/* Region chips */}
      <div className={css({ display: 'flex', gap: '2', flexWrap: 'wrap', alignItems: 'center' })}>
        <span className={css({ fontSize: 'xs', color: 'fg.subtle', fontWeight: 'medium' })}>
          Region
        </span>
        {REGIONS.map((r) => {
          const active = filterState.regions.includes(r);
          return (
            <button
              key={r}
              onClick={() => onToggleRegion(r)}
              className={css(chipBase, {
                bg: active ? 'blue.500' : 'bg.page',
                color: active ? 'white' : 'fg.muted',
                borderColor: active ? 'blue.500' : 'bd.strong',
                _hover: { borderColor: 'blue.400' },
              })}
            >
              {r}
            </button>
          );
        })}
      </div>

      {/* Category chips */}
      <div className={css({ display: 'flex', gap: '2', flexWrap: 'wrap', alignItems: 'center' })}>
        <span className={css({ fontSize: 'xs', color: 'fg.subtle', fontWeight: 'medium' })}>
          Category
        </span>
        {CATEGORIES.map((c) => {
          const active = filterState.categories.includes(c);
          return (
            <button
              key={c}
              onClick={() => onToggleCategory(c)}
              className={css(chipBase, {
                bg: active ? 'violet.500' : 'white',
                color: active ? 'white' : 'gray.600',
                borderColor: active ? 'violet.500' : 'gray.300',
                _hover: { borderColor: 'violet.400' },
              })}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Sort + selection actions */}
      <div className={css({ display: 'flex', gap: '3', alignItems: 'center', flexWrap: 'wrap' })}>
        <span className={css({ fontSize: 'xs', color: 'fg.subtle', fontWeight: 'medium' })}>
          Sort by
        </span>
        <select
          value={filterState.sortBy}
          onChange={(e) => onSetSortBy(e.target.value as SortBy)}
          className={css({
            px: '2',
            py: '1',
            border: '1px solid',
            borderColor: 'bd.strong',
            borderRadius: 'md',
            fontSize: 'sm',
            cursor: 'pointer',
            bg: 'bg.page',
            color: 'fg.default',
          })}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          onClick={onToggleSortDir}
          aria-label={filterState.sortDir === 'asc' ? 'Sort descending' : 'Sort ascending'}
          className={css(chipBase, {
            bg: 'bg.page',
            color: 'fg.muted',
            borderColor: 'bd.strong',
            _hover: { borderColor: 'blue.400' },
          })}
        >
          {filterState.sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
        </button>

        <button
          onClick={onToggleSelectedOnly}
          aria-pressed={selectedOnly}
          className={css(chipBase, {
            bg: selectedOnly ? 'blue.500' : 'bg.page',
            color: selectedOnly ? 'white' : 'fg.muted',
            borderColor: selectedOnly ? 'blue.500' : 'bd.strong',
            _hover: { borderColor: 'blue.400' },
          })}
        >
          Selected only ({selectedCount})
        </button>

        <span className={css({ ml: 'auto', fontSize: 'xs', color: 'fg.faint' })}>
          {filteredCount} / {totalCount}
        </span>

        <button
          onClick={onSelectAll}
          disabled={isAllSelected}
          className={css(chipBase, {
            bg: 'bg.page',
            color: 'fg.muted',
            borderColor: 'bd.strong',
            _hover: { borderColor: 'blue.400' },
            _disabled: { opacity: 0.4, cursor: 'not-allowed' },
          })}
        >
          Select all filtered
        </button>
        <button
          onClick={onClearAll}
          className={css(chipBase, {
            bg: 'bg.page',
            color: 'fg.muted',
            borderColor: 'bd.strong',
            _hover: { borderColor: 'red.400' },
          })}
        >
          Clear selection
        </button>
      </div>
    </div>
  );
}
