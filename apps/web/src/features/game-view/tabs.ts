export type Tab = 'games' | 'scanner' | 'sources' | 'downloads';

export const TAB_LABELS: Record<Tab, string> = {
  games: 'Jeux',
  scanner: 'Scanner',
  sources: 'Sources',
  downloads: 'Téléchargements',
};

/**
 * The tabs a system's view shows. Without a server-side library folder
 * ("browser" downloads) there is nothing for the scanner to check, so its
 * tab disappears instead of asking for a folder nobody needs.
 */
export function visibleTabs(showScanner: boolean): Tab[] {
  if (showScanner) return ['games', 'scanner', 'sources', 'downloads'];
  return ['games', 'sources', 'downloads'];
}

/**
 * The tab the Games tab's "next" button leads to. Specifically the step
 * after Games, not a generic next-tab: it's the shortcut from making a
 * selection to acting on it.
 */
export function tabAfterGames(tabs: Tab[]): Tab | undefined {
  return tabs[tabs.indexOf('games') + 1];
}
