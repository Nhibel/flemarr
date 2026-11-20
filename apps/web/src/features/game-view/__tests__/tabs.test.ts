import { describe, expect, it } from 'vitest';
import { tabAfterGames, visibleTabs } from '../tabs.js';

describe('visibleTabs', () => {
  it('includes the scanner when there is a library folder to check', () => {
    expect(visibleTabs(true)).toEqual(['games', 'scanner', 'sources', 'downloads']);
  });

  it('drops the scanner in browser mode', () => {
    expect(visibleTabs(false)).toEqual(['games', 'sources', 'downloads']);
  });
});

describe('tabAfterGames', () => {
  it('leads to the scanner when it is shown', () => {
    expect(tabAfterGames(visibleTabs(true))).toBe('scanner');
  });

  it('leads to the sources when the scanner is hidden', () => {
    expect(tabAfterGames(visibleTabs(false))).toBe('sources');
  });
});
