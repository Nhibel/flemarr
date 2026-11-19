import { css } from '@/styled-system/css';
import { Button } from '@/components/Button.js';
import { SelectionSummary } from '@/features/game-list/SelectionSummary.js';
import type { Game } from '@shared/dat.js';
import { TAB_LABELS } from './tabs.js';
import type { Tab } from './tabs.js';

interface Props {
  games: Game[];
  selected: Set<string>;
  target: 'server' | 'browser' | undefined;
  /** Where the dock's button leads; no button when undefined. */
  nextTab: Tab | undefined;
  onNext: (tab: Tab) => void;
}

/**
 * A floating action dock under the game list: what is selected, and the
 * button to act on it.
 *
 * Reserved space, not sticky — a fixed slot below the list so the summary's
 * two states don't shift the layout when the selection count changes. Its
 * height scales with the viewport so it doesn't look oversized on a small
 * window or cramped on a large one. The next-tab button lives in the same
 * row instead of adding one of its own — every row here is vertical space
 * taken from the list.
 *
 * Its own rounded surface detached from the page, rather than text sitting
 * loose under the list. SelectionSummary draws no surface of its own (that
 * was a card inside a card), so the dock is the only one here. Radius in
 * literal px, like every other radius since the redesign, so the live
 * font-size control can't round it into a lozenge.
 */
export function SelectionDock({ games, selected, target, nextTab, onNext }: Props) {
  return (
    <div
      className={css({
        flexShrink: '0',
        mt: '3',
        minH: { base: '10', md: '12', lg: '14' },
        display: 'flex',
        alignItems: 'center',
        gap: '3',
        px: '4',
        // bg.inverse, not bg.surface: in six themes they are the same
        // value, and in Sonic Mania the dock is the dark card its artboard
        // makes it. SelectionSummary reads fg.onInverse for the same reason.
        bg: 'bg.inverse',
        borderRadius: '16px',
        shadow: 'lg',
      })}
    >
      <div className={css({ flex: '1', minWidth: '0' })}>
        <SelectionSummary games={games} selected={selected} target={target} />
      </div>
      {/* Primary, not secondary: in the comps the dock's button is the
          filled accent one — it is what you press once the selection is
          made, and the dock exists to carry it. */}
      {nextTab && (
        <Button variant="primary" size="md" onClick={() => onNext(nextTab)}>
          {TAB_LABELS[nextTab]} ›
        </Button>
      )}
    </div>
  );
}
