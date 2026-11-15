import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Makes the `<details>` menus inside a container behave like real menus:
 * opening one closes the others, clicking outside closes them all, and
 * Escape closes them.
 *
 * Native `<details>` does none of this — it is a disclosure widget, not a
 * popover, so two menus stay open at once and neither closes until its own
 * summary is clicked again. The HTML `name` attribute would give the
 * exclusive-accordion behaviour without JS, but it is recent enough
 * (Chrome 120, Safari 17.2, Firefox 130) that the Steam Deck's browser
 * cannot be assumed to have it, and it would still not close on an outside
 * click.
 *
 * `toggle` does not bubble, so it is listened for in the capture phase: a
 * non-bubbling event still travels down through its ancestors on the way
 * to its target.
 *
 * Listeners go on the container, not on each `<details>`, so menus added
 * or removed by a re-render are covered without re-binding anything.
 */
export function useExclusiveDetails(containerRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const all = () => Array.from(container.querySelectorAll('details'));
    const closeAll = (except?: Element) => {
      for (const d of all()) if (d !== except && d.open) d.open = false;
    };

    // Only react to one being OPENED. Firing on close as well would make
    // closing a menu pointlessly walk every sibling.
    const onToggle = (e: Event) => {
      const target = e.target;
      if (target instanceof HTMLDetailsElement && target.open) closeAll(target);
    };

    // pointerdown, not click: it fires before the summary's own click
    // toggles its menu, so closing the others here cannot race with the
    // open that follows. It also covers touch, which matters on the Deck.
    const onPointerDown = (e: Event) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      // A click inside a still-open menu must not close it — only clicks
      // outside every menu close everything.
      for (const d of all()) if (d.open && d.contains(target)) return;
      closeAll();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll();
    };

    container.addEventListener('toggle', onToggle, true);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('toggle', onToggle, true);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [containerRef]);
}
