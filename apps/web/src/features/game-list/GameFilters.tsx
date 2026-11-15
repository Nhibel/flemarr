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
  onToggleRegion: (r: string) => void;
  onToggleCategory: (c: string) => void;
  onSetSortBy: (s: SortBy) => void;
  onToggleSortDir: () => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  isAllSelected: boolean;
}

// One trigger button shape for every control in the row, so the row reads
// as a single band of equal-weight controls rather than a mix of pills,
// selects and chips. Filled, not outlined — same reason the card lost its
// border. Literal px for the radius and the height: both are rescaled by
// the live font-size control if expressed in rem, which would round these
// into pills and shrink the tap targets exactly when the text was made
// bigger to help (this app is used on a Steam Deck).
const triggerClass = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1.5',
  px: '3',
  minH: '34px',
  bg: 'bg.muted',
  color: 'fg.default',
  border: 'none',
  borderRadius: '11px',
  fontSize: 'xs',
  fontWeight: 'medium',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  listStyle: 'none',
  _hover: { bg: 'bg.surface' },
  // <summary> renders a disclosure triangle by default in every engine.
  '&::marker, &::-webkit-details-marker': { display: 'none', content: '""' },
});

// The panel each menu opens. Absolutely positioned so opening one never
// reflows the row — a <details> that pushed the list down every time it
// was opened was the reason the filters used to be three permanently
// expanded rows in the first place.
const panelRaw = css.raw({
  position: 'absolute',
  zIndex: '10',
  top: 'calc(100% + 4px)',
  left: '0',
  minW: '44',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1.5',
  p: '2',
  bg: 'bg.surface',
  borderRadius: '14px',
  shadow: 'lg',
});

const chipBase = css.raw({
  px: '2.5',
  minH: '30px',
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: '9px',
  fontSize: 'xs',
  fontWeight: 'medium',
  border: 'none',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'background-color 0.1s, color 0.1s, box-shadow 0.1s',
});

/** Count of active values, shown on a closed menu so nothing hides. */
function ActiveCount({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span
      className={css({
        fontFamily: 'mono',
        fontSize: '2xs',
        px: '1',
        minW: '4',
        textAlign: 'center',
        borderRadius: '5px',
        bg: 'accent.solid',
        color: 'accent.fg',
      })}
    >
      {n}
    </span>
  );
}

function Caret() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 9l7 7 7-7" />
    </svg>
  );
}

export function GameFilters({
  filterState,
  totalCount,
  filteredCount,
  selectedOnly,
  selectedCount,
  onToggleSelectedOnly,
  onToggleRegion,
  onToggleCategory,
  onSetSortBy,
  onToggleSortDir,
  onSelectAll,
  onClearAll,
  isAllSelected,
}: Props) {
  const sortLabel = SORT_OPTIONS.find((o) => o.value === filterState.sortBy)?.label ?? '';

  return (
    // One row instead of the three stacked ones this used to be (region
    // chips, category chips, then sort plus the selection actions), as the
    // design comps show it. Every chip is still a multi-select toggle with
    // the same behaviour — they moved inside menus rather than being
    // replaced by single-choice dropdowns, and a closed menu shows how
    // many of its values are active so nothing is hidden.
    //
    // flexWrap, because at Steam Deck width (1280px) with a long sort
    // label this row still has to degrade to two lines rather than
    // overflow.
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '2',
        flexWrap: 'wrap',
        pb: '3',
      })}
    >
      {/* Mutually exclusive, so a segmented control with one filled thumb
          rather than a toggle button that only looks pressed. */}
      <div
        className={css({
          display: 'inline-flex',
          gap: '0.5',
          p: '0.5',
          bg: 'bg.muted',
          borderRadius: '12px',
        })}
      >
        <button
          type="button"
          aria-pressed={selectedOnly}
          onClick={() => {
            if (!selectedOnly) onToggleSelectedOnly();
          }}
          className={css(chipBase, {
            bg: selectedOnly ? 'accent.solid' : 'transparent',
            color: selectedOnly ? 'accent.fg' : 'fg.subtle',
            fontWeight: selectedOnly ? 'bold' : 'medium',
            _hover: { color: selectedOnly ? 'accent.fg' : 'fg.default' },
          })}
        >
          Ma sélection&nbsp;
          <span className={css({ fontFamily: 'mono' })}>({selectedCount})</span>
        </button>
        <button
          type="button"
          aria-pressed={!selectedOnly}
          onClick={() => {
            if (selectedOnly) onToggleSelectedOnly();
          }}
          className={css(chipBase, {
            bg: !selectedOnly ? 'accent.solid' : 'transparent',
            color: !selectedOnly ? 'accent.fg' : 'fg.subtle',
            fontWeight: !selectedOnly ? 'bold' : 'medium',
            _hover: { color: !selectedOnly ? 'accent.fg' : 'fg.default' },
          })}
        >
          Tout
        </button>
      </div>

      <details className={css({ position: 'relative' })}>
        <summary className={triggerClass}>
          Région
          <ActiveCount n={filterState.regions.length} />
          <Caret />
        </summary>
        <div className={css(panelRaw)}>
          {REGIONS.map((r) => {
            const active = filterState.regions.includes(r);
            return (
              <button
                key={r}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleRegion(r)}
                className={css(chipBase, {
                  bg: active ? 'accent.solid' : 'bg.muted',
                  color: active ? 'accent.fg' : 'fg.muted',
                  _hover: { color: active ? 'accent.fg' : 'fg.default' },
                })}
              >
                {r}
              </button>
            );
          })}
        </div>
      </details>

      <details className={css({ position: 'relative' })}>
        <summary className={triggerClass}>
          Catégorie
          <ActiveCount n={filterState.categories.length} />
          <Caret />
        </summary>
        <div className={css(panelRaw)}>
          {CATEGORIES.map((c) => {
            const active = filterState.categories.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleCategory(c)}
                className={css(chipBase, {
                  bg: active ? 'accent2.solid' : 'bg.muted',
                  color: active ? 'accent2.fg' : 'fg.muted',
                  _hover: { color: active ? 'accent2.fg' : 'fg.default' },
                })}
              >
                {c}
              </button>
            );
          })}
        </div>
      </details>

      <details className={css({ position: 'relative' })}>
        <summary className={triggerClass}>
          Tri&nbsp;: {sortLabel} {filterState.sortDir === 'asc' ? '↑' : '↓'}
          <Caret />
        </summary>
        <div className={css(panelRaw, { flexDirection: 'column', flexWrap: 'nowrap' })}>
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={filterState.sortBy === o.value}
              onClick={() => onSetSortBy(o.value)}
              className={css(chipBase, {
                justifyContent: 'flex-start',
                bg: filterState.sortBy === o.value ? 'accent.solid' : 'bg.muted',
                color: filterState.sortBy === o.value ? 'accent.fg' : 'fg.muted',
              })}
            >
              {o.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onToggleSortDir}
            aria-label={filterState.sortDir === 'asc' ? 'Tri décroissant' : 'Tri croissant'}
            className={css(chipBase, {
              justifyContent: 'flex-start',
              bg: 'bg.muted',
              color: 'fg.muted',
              _hover: { color: 'fg.default' },
            })}
          >
            {filterState.sortDir === 'asc' ? '↑ Croissant' : '↓ Décroissant'}
          </button>
        </div>
      </details>

      {/* Mono: the two counts are technical data, and a proportional face
          made the row jitter as they changed width. ml:auto pushes them
          and the bulk actions to the right edge, as in the comps. */}
      <span
        className={css({
          ml: 'auto',
          fontFamily: 'mono',
          fontSize: 'xs',
          color: 'fg.subtle',
        })}
      >
        {filteredCount} / {totalCount}
      </span>

      <button
        type="button"
        onClick={onSelectAll}
        disabled={isAllSelected}
        className={css(chipBase, {
          bg: 'transparent',
          color: 'fg.subtle',
          _hover: { bg: 'bg.muted', color: 'fg.default' },
          _disabled: { opacity: 0.4, cursor: 'not-allowed', _hover: { bg: 'transparent' } },
        })}
      >
        Tout sélectionner
      </button>
      <button
        type="button"
        onClick={onClearAll}
        className={css(chipBase, {
          bg: 'transparent',
          color: 'fg.subtle',
          _hover: { bg: 'status.danger.subtle', color: 'status.danger.text' },
        })}
      >
        Désélectionner
      </button>
    </div>
  );
}
