import { describe, expect, it } from 'vitest';
import { gamesToResolve, resolvePanelFlags } from '../resolve-panel-flags.js';
import type { ResolvePanelFlagsInput } from '../resolve-panel-flags.js';

const READY: ResolvePanelFlagsInput = {
  sourceCount: 1,
  activeSourceCount: 1,
  resolvedSourceKey: 'a:direct',
  currentSourceKey: 'a:direct',
  downloadTarget: 'server',
  destinationDir: '/roms/snes',
  settingsLoaded: true,
  toResolveCount: 2,
  resolving: false,
  queuing: false,
};

function flags(over: Partial<ResolvePanelFlagsInput> = {}) {
  return resolvePanelFlags({ ...READY, ...over });
}

describe('resolvePanelFlags', () => {
  it('allows resolving and downloading when everything is in place', () => {
    expect(flags()).toMatchObject({ canResolve: true, canDownload: true, isStale: false });
  });

  it('marks results stale once the source list changed', () => {
    expect(flags({ currentSourceKey: 'b:direct' })).toMatchObject({
      isStale: true,
      canDownload: false,
    });
  });

  it('is never stale before a first resolve', () => {
    expect(flags({ resolvedSourceKey: null, currentSourceKey: '' }).isStale).toBe(false);
  });

  it('blocks a server download without a folder, and says so once settings loaded', () => {
    expect(flags({ destinationDir: '' })).toMatchObject({
      canDownload: false,
      hasNoFolder: true,
    });
    expect(flags({ destinationDir: '', settingsLoaded: false })).toMatchObject({
      canDownload: false,
      hasNoFolder: false,
    });
  });

  it('needs no folder for a browser download', () => {
    expect(flags({ downloadTarget: 'browser', destinationDir: '' })).toMatchObject({
      canDownload: true,
      hasNoFolder: false,
    });
  });

  it('cannot resolve with every source switched off', () => {
    expect(flags({ activeSourceCount: 0 })).toMatchObject({
      hasNoActiveSource: true,
      canResolve: false,
    });
  });

  it('cannot resolve without sources, without games, or while resolving', () => {
    expect(flags({ sourceCount: 0 }).canResolve).toBe(false);
    expect(flags({ toResolveCount: 0 }).canResolve).toBe(false);
    expect(flags({ resolving: true }).canResolve).toBe(false);
  });
});

describe('gamesToResolve', () => {
  it('drops owned games when asked and a scan ran', () => {
    expect(gamesToResolve(['a', 'b'], ['b'], true)).toEqual(['b']);
  });

  it('keeps the whole selection otherwise', () => {
    expect(gamesToResolve(['a', 'b'], ['b'], false)).toEqual(['a', 'b']);
    expect(gamesToResolve(['a', 'b'], null, true)).toEqual(['a', 'b']);
  });
});
