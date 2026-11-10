import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddSourceForm } from './AddSourceForm.js';
import * as api from '@/lib/api.js';

vi.mock('@/lib/api.js');

const SYSTEM = 'Nintendo - Super Nintendo Entertainment System';

function renderForm(onDone = vi.fn()) {
  render(<AddSourceForm system={SYSTEM} source="no-intro" onDone={onDone} />);
  return {
    onDone,
    searchBtn: screen.getByRole('button', { name: /chercher/i }),
    queryInput: screen.getByPlaceholderText(/No-Intro SNES/i),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AddSourceForm — search', () => {
  it('says so when the search found nothing', async () => {
    vi.mocked(api.searchArchive).mockResolvedValue({ results: [] });
    const { searchBtn } = renderForm();

    await userEvent.click(searchBtn);

    expect(await screen.findByText(/aucune collection trouvée/i)).toBeInTheDocument();
  });

  it('lists the hits when the search found some', async () => {
    vi.mocked(api.searchArchive).mockResolvedValue({
      results: [{ identifier: 'snes-roms', title: 'SNES ROMs', description: '' }],
    });
    const { searchBtn } = renderForm();

    await userEvent.click(searchBtn);

    expect(await screen.findByText('snes-roms')).toBeInTheDocument();
    expect(screen.queryByText(/aucune collection trouvée/i)).not.toBeInTheDocument();
  });

  it('drops stale hits when a search fails', async () => {
    vi.mocked(api.searchArchive).mockResolvedValue({
      results: [{ identifier: 'snes-roms', title: 'SNES ROMs', description: '' }],
    });
    const { searchBtn } = renderForm();
    await userEvent.click(searchBtn);
    expect(await screen.findByText('snes-roms')).toBeInTheDocument();

    vi.mocked(api.searchArchive).mockRejectedValue(new Error('archive.org injoignable'));
    await userEvent.click(searchBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent('archive.org injoignable');
    expect(screen.queryByText('snes-roms')).not.toBeInTheDocument();
  });

  it('clears a previous error once a search succeeds', async () => {
    vi.mocked(api.searchArchive).mockRejectedValue(new Error('archive.org injoignable'));
    const { searchBtn } = renderForm();
    await userEvent.click(searchBtn);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    vi.mocked(api.searchArchive).mockResolvedValue({ results: [] });
    await userEvent.click(searchBtn);

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  // archive.org gives no response-time guarantee: a second search started
  // before the first answers would let the slower one overwrite the newer
  // results, so an in-flight search blocks both the button and the Enter key.
  it('refuses a second search while one is in flight', async () => {
    let releaseFirst: () => void = () => undefined;
    vi.mocked(api.searchArchive).mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseFirst = () =>
            resolve({
              results: [{ identifier: 'first-query-hit', title: 'First', description: '' }],
            });
        }),
    );

    const { searchBtn, queryInput } = renderForm();
    await userEvent.click(searchBtn);
    expect(searchBtn).toBeDisabled();

    await userEvent.clear(queryInput);
    await userEvent.type(queryInput, 'other query{Enter}');
    expect(vi.mocked(api.searchArchive)).toHaveBeenCalledTimes(1);

    releaseFirst();
    expect(await screen.findByText('first-query-hit')).toBeInTheDocument();
    expect(searchBtn).toBeEnabled();
  });
});

describe('AddSourceForm — save', () => {
  it('detects the layout then adds the source, and reports back', async () => {
    vi.mocked(api.previewIndex).mockResolvedValue({
      identifier: 'snes-roms',
      fileCount: 12,
      preview: [],
      suggestedLayout: 'zip-collection',
    });
    vi.mocked(api.addSource).mockResolvedValue(undefined);
    const { onDone } = renderForm();

    await userEvent.type(screen.getByPlaceholderText(/identifiant archive\.org/i), 'snes-roms');
    await userEvent.click(screen.getByRole('button', { name: /ajouter la source/i }));

    await waitFor(() =>
      expect(vi.mocked(api.addSource)).toHaveBeenCalledWith(SYSTEM, {
        identifier: 'snes-roms',
        layout: 'zip-collection',
        note: '',
      }),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it('keeps the form open and explains when the add fails', async () => {
    vi.mocked(api.previewIndex).mockResolvedValue({
      identifier: 'snes-roms',
      fileCount: 12,
      preview: [],
      suggestedLayout: 'direct',
    });
    vi.mocked(api.addSource).mockRejectedValue(new Error('HTTP 500'));
    const { onDone } = renderForm();

    await userEvent.type(screen.getByPlaceholderText(/identifiant archive\.org/i), 'snes-roms');
    await userEvent.click(screen.getByRole('button', { name: /ajouter la source/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 500');
    expect(onDone).not.toHaveBeenCalled();
  });
});
