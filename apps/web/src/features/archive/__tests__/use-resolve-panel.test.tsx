import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SettingsResponse } from '@shared/settings.js';
import * as api from '@/lib/api.js';
import { useResolvePanel } from '../use-resolve-panel.js';
import { queryKeys } from '@/lib/query-keys.js';

vi.mock('@/lib/api.js');

const SYSTEM = 'Sony - PlayStation';
const SOURCE = { identifier: 'psx', layout: 'direct' as const, note: '' };

function resolvedSource(identifier: string) {
  return {
    identifier,
    container: 'direct' as const,
    extractFromZip: false,
    downloadUrl: `https://archive.org/download/${identifier}/game.bin`,
    verified: true,
  };
}

const RESOLVED: api.ResolveResponse = {
  results: [
    {
      gameId: 'g1',
      gameName: 'Game',
      roms: [
        {
          romName: 'Game.bin',
          expectedCrc: 'aabbccdd',
          sources: [resolvedSource('psx'), resolvedSource('psx-alt')],
        },
      ],
    },
  ],
};

function settings(over: Partial<SettingsResponse> = {}): SettingsResponse {
  return {
    fresh1g1rPreset: 'PropeR',
    downloaderConcurrency: 2,
    systemPaths: {},
    downloadTarget: 'browser',
    topology: 'remote',
    autoConvertChd: false,
    archiveOrgKeysConfigured: false,
    archiveOrgSessionConfigured: false,
    romsRoot: null,
    ...over,
  };
}

function renderPanelHook({
  selectedGameIds = ['g1', 'g2'],
  missingGameIds = null as string[] | null,
  pickedSources = new Set<string>() as ReadonlySet<string>,
} = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const onQueueDownload = vi.fn();
  const hook = renderHook(
    () =>
      useResolvePanel({
        datId: 'dat1',
        system: SYSTEM,
        selectedGameIds,
        missingGameIds,
        onQueueDownload,
        pickedSources,
      }),
    { wrapper },
  );
  return { ...hook, onQueueDownload, client };
}

/** Renders the hook and waits for sources and the browser target to load. */
async function renderBrowserReady(options: Parameters<typeof renderPanelHook>[0] = {}) {
  const rendered = renderPanelHook(options);
  await waitFor(() => {
    expect(rendered.result.current.canResolve).toBe(true);
    expect(rendered.result.current.downloadTarget).toBe('browser');
  });
  return rendered;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchSources).mockResolvedValue({ system: SYSTEM, sources: [SOURCE] });
  vi.mocked(api.getSettings).mockResolvedValue(settings());
  vi.mocked(api.resolveGames).mockResolvedValue(RESOLVED);
  vi.mocked(api.startDownload).mockResolvedValue('job1');
});

describe('useResolvePanel — which games to resolve', () => {
  it('leaves owned games out by default once a scan ran', () => {
    const { result } = renderPanelHook({ missingGameIds: ['g2'] });
    expect(result.current.effectiveGameIds).toEqual(['g2']);
  });

  it('resolves every selected game when owned ones are included', () => {
    const { result } = renderPanelHook({ missingGameIds: ['g2'] });
    act(() => result.current.setExcludeOwned(false));
    expect(result.current.effectiveGameIds).toEqual(['g1', 'g2']);
  });

  it('resolves every selected game when no scan ran', () => {
    const { result } = renderPanelHook();
    expect(result.current.effectiveGameIds).toEqual(['g1', 'g2']);
  });
});

describe('useResolvePanel — source filter', () => {
  beforeEach(() => {
    vi.mocked(api.fetchSources).mockResolvedValue({
      system: SYSTEM,
      sources: [SOURCE, { identifier: 'psx-alt', layout: 'direct', note: '' }],
    });
  });

  it('searches every source while none is ticked', async () => {
    const { result } = await renderBrowserReady();
    await act(() => result.current.resolve());
    expect(api.resolveGames).toHaveBeenCalledWith('dat1', ['g1', 'g2'], []);
  });

  it('searches only the ticked sources', async () => {
    const { result } = await renderBrowserReady({ pickedSources: new Set(['psx-alt']) });
    await act(() => result.current.resolve());
    expect(api.resolveGames).toHaveBeenCalledWith('dat1', ['g1', 'g2'], ['psx-alt']);
  });

  it('forgets a ticked source once it is removed from the configuration', async () => {
    const { result, client } = await renderBrowserReady({ pickedSources: new Set(['psx-alt']) });
    expect(result.current.searchedSources).toEqual(['psx-alt']);

    vi.mocked(api.fetchSources).mockResolvedValue({ system: SYSTEM, sources: [SOURCE] });
    await act(() => client.invalidateQueries({ queryKey: queryKeys.archiveSources(SYSTEM) }));
    await waitFor(() => expect(result.current.searchedSources).toEqual([]));
  });
});

describe('useResolvePanel — queueing', () => {
  it('queues a browser download with no destination folder', async () => {
    const { result, onQueueDownload } = await renderBrowserReady();
    await act(() => result.current.resolve());
    await act(() => result.current.download());

    const request = vi.mocked(api.startDownload).mock.calls[0]?.[0];
    expect(request?.target).toBe('browser');
    expect(request).not.toHaveProperty('destinationDir');
    expect(onQueueDownload).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job1', target: 'browser' }),
    );
  });

  it('queues a server download into the system folder', async () => {
    vi.mocked(api.getSettings).mockResolvedValue(
      settings({ downloadTarget: 'server', systemPaths: { [SYSTEM]: '/roms/psx' } }),
    );
    const { result, onQueueDownload } = renderPanelHook();
    await waitFor(() => expect(result.current.destinationDir).toBe('/roms/psx'));
    await act(() => result.current.resolve());
    await act(() => result.current.download());

    expect(onQueueDownload).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'server', destinationDir: '/roms/psx' }),
    );
  });

  it('refuses a server download without a system folder', async () => {
    vi.mocked(api.getSettings).mockResolvedValue(settings({ downloadTarget: 'server' }));
    const { result } = renderPanelHook();
    await waitFor(() => expect(result.current.hasNoFolder).toBe(true));
    await act(() => result.current.resolve());

    expect(result.current.canDownload).toBe(false);
    await act(() => result.current.download());
    expect(api.startDownload).not.toHaveBeenCalled();
  });

  it('downloads from the source picked for a ROM', async () => {
    const { result } = await renderBrowserReady();
    await act(() => result.current.resolve());
    act(() => result.current.selectSource('g1', 'Game.bin', 1));
    await act(() => result.current.download());

    const request = vi.mocked(api.startDownload).mock.calls[0]?.[0];
    expect(request?.items[0]?.sources[0]?.url).toBe(resolvedSource('psx-alt').downloadUrl);
  });

  it('forgets the picked source on a new resolve', async () => {
    const { result } = await renderBrowserReady();
    await act(() => result.current.resolve());
    act(() => result.current.selectSource('g1', 'Game.bin', 1));
    await act(() => result.current.resolve());

    expect(result.current.selectedSourceIndex.size).toBe(0);
  });

  it('reports a failed launch', async () => {
    vi.mocked(api.startDownload).mockRejectedValue(new Error('archive.org down'));
    const { result, onQueueDownload } = await renderBrowserReady();
    await act(() => result.current.resolve());
    await act(() => result.current.download());

    expect(result.current.error).toBe('archive.org down');
    expect(onQueueDownload).not.toHaveBeenCalled();
  });
});
