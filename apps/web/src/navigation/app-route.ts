import type { Tab } from '@/features/game-view/tabs.js';
import type { DatSummary } from '@shared/dat.js';

/**
 * The screen the app shows, as kept in the URL hash. There is no router:
 * the hash holds just enough for a reload, a bookmark or the browser's back
 * button to land on the same screen.
 *
 *   #/                         the systems
 *   #/systems/<datId>/<tab>    one system, on one tab
 *   #/settings, #/lexique      the two full pages
 */
export type AppRoute =
  | { screen: 'systems' }
  | { screen: 'game'; datId: string; tab: Tab }
  | { screen: 'settings' }
  | { screen: 'lexique' };

const TABS: readonly Tab[] = ['games', 'scanner', 'sources', 'downloads'];

function isTab(value: string | undefined): value is Tab {
  return TABS.includes(value as Tab);
}

/** Anything unknown reads as the systems screen, never as an error. */
export function parseHash(hash: string): AppRoute {
  const [first, datId, tab] = hash.replace(/^#\/?/, '').split('/');
  switch (first) {
    case 'settings':
      return { screen: 'settings' };
    case 'lexique':
      return { screen: 'lexique' };
    case 'systems':
      if (!datId) return { screen: 'systems' };
      return {
        screen: 'game',
        datId: decodeURIComponent(datId),
        tab: isTab(tab) ? tab : 'games',
      };
    default:
      return { screen: 'systems' };
  }
}

export function routeToHash(route: AppRoute): string {
  switch (route.screen) {
    case 'systems':
      return '#/';
    case 'game':
      return `#/systems/${encodeURIComponent(route.datId)}/${route.tab}`;
    case 'settings':
      return '#/settings';
    case 'lexique':
      return '#/lexique';
  }
}

/**
 * The system the route opens, once the DAT list is known. A link to a
 * removed DAT opens nothing, so the systems screen shows instead.
 */
export function openedSystem<Dat extends DatSummary>(
  route: AppRoute,
  knownDats: Dat[] | undefined,
): { activeDat: Dat | null; isWaitingForDats: boolean } {
  if (route.screen !== 'game') return { activeDat: null, isWaitingForDats: false };
  if (knownDats === undefined) return { activeDat: null, isWaitingForDats: true };
  const activeDat = knownDats.find((dat) => dat.id === route.datId) ?? null;
  return { activeDat, isWaitingForDats: false };
}
