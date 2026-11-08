import { css } from '@/styled-system/css';
import type { FilterState, SortBy } from './use-game-filters.js';

const REGIONS = ['Europe', 'USA', 'Japan', 'World'];
const CATEGORIES = ['Game', 'Demo', 'Proto', 'Beta', 'Unl', 'Aftermarket'];
const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'name', label: 'Nom' },
  { value: 'region', label: 'Région' },
  { value: 'size', label: 'Taille' },
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
      {/* Region chips */}
      <div className={css({ display: 'flex', gap: '2', flexWrap: 'wrap', alignItems: 'center' })}>
        <span className={css({ fontSize: 'xs', color: 'fg.subtle', fontWeight: 'medium' })}>
          Région
        </span>
        {REGIONS.map((r) => {
          const active = filterState.regions.includes(r);
          return (
            <button
              key={r}
              onClick={() => onToggleRegion(r)}
              className={css(chipBase, {
                bg: active ? 'accent.solid' : 'bg.page',
                color: active ? 'accent.fg' : 'fg.muted',
                borderColor: active ? 'accent.solid' : 'bd.strong',
                _hover: { borderColor: 'accent.hover' },
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
          Catégorie
        </span>
        {CATEGORIES.map((c) => {
          const active = filterState.categories.includes(c);
          return (
            <button
              key={c}
              onClick={() => onToggleCategory(c)}
              className={css(chipBase, {
                bg: active ? 'violet.500' : 'bg.page',
                color: active ? 'white' : 'fg.muted',
                borderColor: active ? 'violet.500' : 'bd.strong',
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
          Trier par
        </span>
        <select
          value={filterState.sortBy}
          onChange={(e) => onSetSortBy(e.target.value as SortBy)}
          className={css({
            px: '2',
            py: '1',
            border: '1px solid',
            borderColor: 'bd.strong',
            borderRadius: 'lg',
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
          aria-label={filterState.sortDir === 'asc' ? 'Tri décroissant' : 'Tri croissant'}
          className={css(chipBase, {
            bg: 'bg.page',
            color: 'fg.muted',
            borderColor: 'bd.strong',
            _hover: { borderColor: 'accent.hover' },
          })}
        >
          {filterState.sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
        </button>

        <button
          onClick={onToggleSelectedOnly}
          aria-pressed={selectedOnly}
          className={css(chipBase, {
            bg: selectedOnly ? 'accent.solid' : 'bg.page',
            color: selectedOnly ? 'accent.fg' : 'fg.muted',
            borderColor: selectedOnly ? 'accent.solid' : 'bd.strong',
            _hover: { borderColor: 'accent.hover' },
          })}
        >
          Sélection uniquement ({selectedCount})
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
            _hover: { borderColor: 'accent.hover' },
            _disabled: { opacity: 0.4, cursor: 'not-allowed' },
          })}
        >
          Tout sélectionner (filtré)
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
          Désélectionner tout
        </button>
      </div>

      {/* Search — below the filter criteria, right above the list it filters */}
      <input
        type="search"
        placeholder={`Rechercher parmi ${totalCount} jeux…`}
        value={filterState.search}
        onChange={(e) => onSearch(e.target.value)}
        className={css({
          w: 'full',
          px: '3',
          py: '2',
          border: '1px solid',
          borderColor: 'bd.strong',
          borderRadius: 'lg',
          fontSize: 'sm',
          outline: 'none',
          _focusVisible: {
            borderColor: 'accent.hover',
            ring: '2px',
            ringColor: 'accent.subtleBorder',
          },
        })}
      />
    </div>
  );
}
