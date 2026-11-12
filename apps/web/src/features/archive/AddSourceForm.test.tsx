import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddSourceForm } from './AddSourceForm.js';
import * as api from '@/lib/api.js';

vi.mock('@/lib/api.js');

const SYSTEM = 'Nintendo - Super Nintendo Entertainment System';

function renderForm(onDone = vi.fn(), onAdded = vi.fn()) {
  render(<AddSourceForm system={SYSTEM} source="no-intro" onDone={onDone} onAdded={onAdded} />);
  return {
    onDone,
    onAdded,
    searchBtn: screen.getByRole('button', { name: /chercher/i }),
    queryInput: screen.getByPlaceholderText(/No-Intro SNES/i),
    seriesCheckbox: screen.getByRole('checkbox', { name: /toute la série/i }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AddSourceForm — close', () => {
  it('calls onDone when the close button is clicked', async () => {
    const { onDone } = renderForm();

    await userEvent.click(screen.getByRole('button', { name: /fermer/i }));

    expect(onDone).toHaveBeenCalled();
  });
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

  // Deliberately not "sony_playstation_part1" — that exact string is also the
  // app's own static hint-text example lower on the page, which would make
  // `findByText` match two elements at once.
  it('expands to the whole series when the box is checked and a hit looks like a split part', async () => {
    vi.mocked(api.searchArchive).mockImplementation(async (q: string) => {
      if (q === 'redump_test*') {
        return {
          results: [
            { identifier: 'redump_test_part1', title: 'Part 1', description: '' },
            { identifier: 'redump_test_part2', title: 'Part 2', description: '' },
          ],
        };
      }
      return {
        results: [{ identifier: 'redump_test_part1', title: 'Part 1', description: '' }],
      };
    });
    const { searchBtn, seriesCheckbox } = renderForm();

    await userEvent.click(seriesCheckbox);
    await userEvent.click(searchBtn);

    expect(await screen.findByText('redump_test_part2')).toBeInTheDocument();
    expect(screen.getByText('redump_test_part1')).toBeInTheDocument();
    expect(vi.mocked(api.searchArchive)).toHaveBeenCalledWith('redump_test*');
  });

  it('does not expand to the series when the box is left unchecked', async () => {
    vi.mocked(api.searchArchive).mockResolvedValue({
      results: [{ identifier: 'redump_test_part1', title: 'Part 1', description: '' }],
    });
    const { searchBtn } = renderForm();

    await userEvent.click(searchBtn);

    expect(await screen.findByText('redump_test_part1')).toBeInTheDocument();
    expect(vi.mocked(api.searchArchive)).toHaveBeenCalledTimes(1);
  });
});

describe('AddSourceForm — adding a search result directly', () => {
  it('adds a result with auto-detected layout and keeps the form open', async () => {
    vi.mocked(api.searchArchive).mockResolvedValue({
      results: [{ identifier: 'snes-roms', title: 'SNES ROMs', description: '' }],
    });
    vi.mocked(api.previewIndex).mockResolvedValue({
      identifier: 'snes-roms',
      fileCount: 12,
      preview: [],
      suggestedLayout: 'zip-collection',
    });
    vi.mocked(api.addSource).mockResolvedValue(undefined);
    const { searchBtn, onAdded, onDone } = renderForm();

    await userEvent.click(searchBtn);
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter' }));

    await waitFor(() =>
      expect(vi.mocked(api.addSource)).toHaveBeenCalledWith(SYSTEM, {
        identifier: 'snes-roms',
        layout: 'zip-collection',
        note: 'SNES ROMs',
      }),
    );
    expect(onAdded).toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('shows a row-scoped error and leaves the other rows usable', async () => {
    vi.mocked(api.searchArchive).mockResolvedValue({
      results: [
        { identifier: 'bad-item', title: 'Bad', description: '' },
        { identifier: 'good-item', title: 'Good', description: '' },
      ],
    });
    vi.mocked(api.previewIndex).mockImplementation(async (id: string) => {
      if (id === 'bad-item') throw new Error('item introuvable');
      return { identifier: id, fileCount: 1, preview: [], suggestedLayout: 'direct' };
    });
    vi.mocked(api.addSource).mockResolvedValue(undefined);
    const { searchBtn } = renderForm();

    await userEvent.click(searchBtn);
    const addButtons = await screen.findAllByRole('button', { name: 'Ajouter' });
    await userEvent.click(addButtons[0]!);

    expect(await screen.findByRole('alert')).toHaveTextContent('item introuvable');

    await userEvent.click(addButtons[1]!);
    await waitFor(() =>
      expect(vi.mocked(api.addSource)).toHaveBeenCalledWith(SYSTEM, {
        identifier: 'good-item',
        layout: 'direct',
        note: 'Good',
      }),
    );
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

    await userEvent.click(screen.getByRole('button', { name: /je connais déjà l.identifiant/i }));
    await userEvent.type(screen.getByPlaceholderText(/identifiant de l/i), 'snes-roms');
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

  it('still validates the identifier exists even when the layout is chosen manually', async () => {
    // archive.org's metadata endpoint returns 200 with an empty `{}` for an
    // identifier that doesn't exist — previewIndex turns that into a
    // rejection (see metadata.ts). Picking a layout by hand used to skip
    // previewIndex entirely, so a typo'd/made-up identifier was accepted
    // here and only ever surfaced later as "this source never finds
    // anything", indistinguishable from a real but empty source.
    vi.mocked(api.previewIndex).mockRejectedValue(
      new Error('Unexpected metadata shape for rr-sony-playstation-b'),
    );
    const { onDone } = renderForm();

    await userEvent.click(screen.getByRole('button', { name: /je connais déjà l.identifiant/i }));
    await userEvent.type(screen.getByPlaceholderText(/identifiant de l/i), 'rr-sony-playstation-b');
    await userEvent.selectOptions(screen.getByRole('combobox'), 'direct');
    await userEvent.click(screen.getByRole('button', { name: /ajouter la source/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unexpected metadata shape for rr-sony-playstation-b',
    );
    expect(vi.mocked(api.addSource)).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
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

    await userEvent.click(screen.getByRole('button', { name: /je connais déjà l.identifiant/i }));
    await userEvent.type(screen.getByPlaceholderText(/identifiant de l/i), 'snes-roms');
    await userEvent.click(screen.getByRole('button', { name: /ajouter la source/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 500');
    expect(onDone).not.toHaveBeenCalled();
  });
});
