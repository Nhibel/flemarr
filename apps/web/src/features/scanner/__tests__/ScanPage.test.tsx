import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@/lib/api.js';
import type { ScanEvent } from '@shared/scan.js';
import { ScanPage } from '../ScanPage.js';

vi.mock('@/lib/api.js');

/** Stands in for the scan's EventSource: the test pushes events into it. */
function fakeEventSource() {
  const source = {
    onmessage: null as ((message: { data: string }) => void) | null,
    close: vi.fn(),
  };
  const send = (event: ScanEvent) => act(() => source.onmessage?.({ data: JSON.stringify(event) }));
  return { source, send };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getSettings).mockResolvedValue({
    fresh1g1rPreset: 'PropeR',
    downloaderConcurrency: 2,
    systemPaths: { 'Sony - PlayStation': '/roms/psx' },
    downloadTarget: 'server',
    topology: 'local',
    autoConvertChd: true,
    archiveOrgKeysConfigured: false,
    archiveOrgSessionConfigured: false,
    romsRoot: '/roms',
  });
  vi.mocked(api.startScan).mockResolvedValue({ jobId: 'job-1' });
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ScanPage datId="d1" system="Sony - PlayStation" />
    </QueryClientProvider>,
  );
}

describe('ScanPage', () => {
  // Decompressing a disc takes long seconds; without saying so, the scan
  // looked frozen.
  it('says which .chd it is decompressing', async () => {
    const { source, send } = fakeEventSource();
    vi.mocked(api.openScanEvents).mockReturnValue(source as unknown as EventSource);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Scanner' }));
    await send({ type: 'progress', scanned: 0, total: 1, extracting: 'renamed.chd' });

    expect(screen.getByText(/Décompression de renamed.chd pour l.identifier/)).toBeInTheDocument();

    await send({ type: 'progress', scanned: 1, total: 1 });
    expect(screen.queryByText(/Décompression de/)).not.toBeInTheDocument();
  });
});
