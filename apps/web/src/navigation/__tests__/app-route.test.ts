import { describe, it, expect } from 'vitest';
import { openedSystem, parseHash, routeToHash } from '../app-route.js';
import type { AppRoute } from '../app-route.js';

describe('parseHash', () => {
  it('reads an empty hash as the systems screen', () => {
    expect(parseHash('')).toEqual({ screen: 'systems' });
    expect(parseHash('#/')).toEqual({ screen: 'systems' });
  });

  it('reads a system and its tab', () => {
    expect(parseHash('#/systems/dat-1/sources')).toEqual({
      screen: 'game',
      datId: 'dat-1',
      tab: 'sources',
    });
  });

  it('opens the Games tab when the tab is missing or unknown', () => {
    expect(parseHash('#/systems/dat-1')).toMatchObject({ tab: 'games' });
    expect(parseHash('#/systems/dat-1/nope')).toMatchObject({ tab: 'games' });
  });

  it('reads the settings page', () => {
    expect(parseHash('#/settings')).toEqual({ screen: 'settings' });
  });

  it('falls back to the systems screen on anything else', () => {
    expect(parseHash('#/whatever/else')).toEqual({ screen: 'systems' });
  });
});

describe('routeToHash', () => {
  const routes: AppRoute[] = [
    { screen: 'systems' },
    { screen: 'game', datId: 'a b/c', tab: 'downloads' },
    { screen: 'settings' },
  ];

  it.each(routes)('round-trips %o', (route) => {
    expect(parseHash(routeToHash(route))).toEqual(route);
  });
});

describe('openedSystem', () => {
  const SNES = { id: 'd1', system: 'SNES', gameCount: 1, source: 'no-intro' as const };
  const onSnes: AppRoute = { screen: 'game', datId: 'd1', tab: 'games' };

  it('waits for the DAT list before deciding', () => {
    expect(openedSystem(onSnes, undefined)).toEqual({ activeDat: null, isWaitingForDats: true });
  });

  it('finds the system of the route', () => {
    expect(openedSystem(onSnes, [SNES]).activeDat).toBe(SNES);
  });

  it('opens nothing for a removed system or another screen', () => {
    expect(openedSystem({ ...onSnes, datId: 'gone' }, [SNES]).activeDat).toBeNull();
    expect(openedSystem({ screen: 'settings' }, [SNES])).toEqual({
      activeDat: null,
      isWaitingForDats: false,
    });
  });
});
