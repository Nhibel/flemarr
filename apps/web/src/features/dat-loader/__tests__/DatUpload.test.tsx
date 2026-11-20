import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DatUpload } from '../DatUpload.js';
import * as api from '@/lib/api.js';
import { queryKeys } from '@/lib/query-keys.js';

vi.mock('@/lib/api.js');

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DatUpload', () => {
  it('renders the drop zone', () => {
    render(<DatUpload onSuccess={vi.fn()} />, { wrapper });
    expect(screen.getByRole('button', { name: /importer un fichier dat/i })).toBeInTheDocument();
  });

  it('calls uploadDat when a file is selected via input', async () => {
    const mockUpload = vi.mocked(api.uploadDat).mockResolvedValue({
      id: 'abc',
      system: 'Test System',
      gameCount: 3,
      source: 'no-intro',
    });

    render(<DatUpload onSuccess={vi.fn()} />, { wrapper });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['<datafile/>'], 'test.dat', { type: 'application/xml' });
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalled();
      expect(mockUpload.mock.calls[0]?.[0]).toStrictEqual(file);
    });
  });

  it('calls onSuccess with the summary on successful upload', async () => {
    const summary = { id: 'abc', system: 'Test System', gameCount: 3, source: 'no-intro' as const };
    vi.mocked(api.uploadDat).mockResolvedValue(summary);
    const onSuccess = vi.fn();

    render(<DatUpload onSuccess={onSuccess} />, { wrapper });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['<datafile/>'], 'test.dat', { type: 'application/xml' });
    await userEvent.upload(input, file);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(summary));
  });

  it('refreshes the systems list itself once the upload succeeds', async () => {
    vi.mocked(api.uploadDat).mockResolvedValue({
      id: 'abc',
      system: 'Test System',
      gameCount: 3,
      source: 'no-intro',
    });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    client.setQueryData(queryKeys.dats(), []);

    render(
      <QueryClientProvider client={client}>
        <DatUpload onSuccess={vi.fn()} />
      </QueryClientProvider>,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(['<datafile/>'], 'test.dat'));

    await waitFor(() => expect(client.getQueryState(queryKeys.dats())?.isInvalidated).toBe(true));
  });

  it('shows error message on upload failure', async () => {
    vi.mocked(api.uploadDat).mockRejectedValue(new Error('Parse failed'));

    render(<DatUpload onSuccess={vi.fn()} />, { wrapper });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File([''], 'bad.dat'));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Parse failed'));
  });
});
