import { describe, it, expect } from 'vitest';
import { TOPOLOGY_OPTIONS, TOPOLOGY_PATCHES, inferTopology } from '../topology.js';
import type { SettingsResponse } from '@/lib/api.js';

function settings(over: Partial<SettingsResponse> = {}): SettingsResponse {
  return {
    fresh1g1rPreset: 'PropeR',
    downloaderConcurrency: 2,
    systemPaths: {},
    archiveOrgKeysConfigured: false,
    archiveOrgSessionConfigured: false,
    downloadTarget: 'server',
    topology: null,
    autoConvertChd: false,
    romsRoot: null,
    ...over,
  };
}

describe('TOPOLOGY_PATCHES', () => {
  // The whole reason this mapping exists in one place: answering the
  // question must always set downloadTarget too, so the two can never drift
  // into disagreeing about where files go.
  it('every answer writes both fields together', () => {
    for (const patch of Object.values(TOPOLOGY_PATCHES)) {
      expect(patch.topology).toBeDefined();
      expect(patch.downloadTarget).toBeDefined();
    }
  });

  it('only the remote answer sends downloads to the browser', () => {
    expect(TOPOLOGY_PATCHES.local.downloadTarget).toBe('server');
    expect(TOPOLOGY_PATCHES.remote.downloadTarget).toBe('browser');
  });

  // Two answers, one per downloadTarget: an answer that maps to the same
  // target as another is a distinction the code never makes.
  it('has exactly one answer per download target', () => {
    const options = TOPOLOGY_OPTIONS.map((option) => option.value);
    expect(options).toEqual(['local', 'remote']);
  });
});

describe('inferTopology', () => {
  it('uses the recorded answer when there is one', () => {
    expect(inferTopology(settings({ topology: 'remote' }))).toBe('remote');
  });

  // Anyone who installed before this field existed has no recorded answer.
  // The settings screen still has to show something selected, and the only
  // thing actually knowable is whether downloads go to the browser.
  it('falls back to what downloadTarget already says', () => {
    expect(inferTopology(settings({ topology: null, downloadTarget: 'browser' }))).toBe('remote');
    expect(inferTopology(settings({ topology: null, downloadTarget: 'server' }))).toBe('local');
  });
});
