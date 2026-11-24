import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ComponentProps, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ScanResult } from '@shared/scan.js';
import * as api from '@/lib/api.js';
import { ScanResults } from '../ScanResults.js';

vi.mock('@/lib/api.js');

function wrongName(file: string) {
  return {
    filePath: `/roms/snes/${file}`,
    currentName: file,
    canonicalName: `Canonical ${file}`,
    crc: 'aabbccdd',
    gameName: `Game ${file}`,
  };
}

const RESULT: ScanResult = {
  matched: [{ filePath: '/roms/snes/ok.sfc', crc: '11111111', romName: 'ok.sfc', gameName: 'Ok' }],
  wrongName: [wrongName('a.sfc'), wrongName('b.sfc')],
  unmatched: [{ filePath: '/roms/snes/junk.txt', crc: 'ffffffff' }],
};

const PROPS: ComponentProps<typeof ScanResults> = {
  datId: 'd1',
  result: RESULT,
  selected: new Set(),
  choices: new Map(),
  onChoose: () => {},
  onToggle: () => {},
  onSetAll: () => {},
  onRename: () => {},
  renaming: false,
};

function withQueryClient(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderResults(over: Partial<ComponentProps<typeof ScanResults>> = {}) {
  return render(withQueryClient(<ScanResults {...PROPS} {...over} />));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchGames).mockResolvedValue([]);
  vi.mocked(api.fetchGameLinks).mockResolvedValue([]);
  vi.mocked(api.getSettings).mockResolvedValue({
    fresh1g1rPreset: 'PropeR',
    downloaderConcurrency: 2,
    systemPaths: {},
    downloadTarget: 'server',
    topology: 'local',
    autoConvertChd: false,
    archiveOrgKeysConfigured: false,
    archiveOrgSessionConfigured: false,
    romsRoot: '/roms',
  });
});

describe('ScanResults', () => {
  it('counts each outcome and the files scanned', () => {
    renderResults();
    expect(screen.getByText('jeu trouvé').parentElement).toHaveTextContent('1');
    expect(screen.getByText('mal nommés').parentElement).toHaveTextContent('2');
    expect(screen.getByText('absent du DAT').parentElement).toHaveTextContent('1');
    expect(screen.getByText('4 fichiers scannés')).toBeInTheDocument();
  });

  it.each([
    ['jeu trouvé', 'scan-section-found'],
    ['mal nommés', 'scan-section-wrongName'],
    ['absent du DAT', 'scan-section-unmatched'],
  ])('folds and unfolds a list from its chip: %s', async (label, id) => {
    const { container } = renderResults();
    const list = container.querySelector<HTMLDetailsElement>(`#${id}`)!;
    const chip = screen.getByRole('button', { name: new RegExp(label) });
    const wasOpen = list.open;
    await userEvent.click(chip);
    expect(list.open).toBe(!wasOpen);
    expect(chip).toHaveAttribute('aria-expanded', String(!wasOpen));
    await userEvent.click(chip);
    expect(list.open).toBe(wasOpen);
  });

  it('counts an attached file apart from the absent ones', async () => {
    vi.mocked(api.fetchGameLinks).mockResolvedValue([
      { fileCrc: 'ffffffff', gameId: 'g1', gameName: 'Catwoman (USA)' },
    ]);
    renderResults();
    const chip = await screen.findByRole('button', { name: /rattaché/ });
    expect(chip).toHaveTextContent('1');
    expect(screen.getByText('absent du DAT').closest('span')).toHaveTextContent('0');
    expect(screen.getByText(/Catwoman/)).toBeInTheDocument();
  });

  it('lists each misnamed file with its canonical name', () => {
    renderResults();
    expect(screen.getByText('a.sfc')).toBeInTheDocument();
    expect(screen.getByText('Canonical a.sfc')).toBeInTheDocument();
    expect(screen.getByText('Game a.sfc')).toBeInTheDocument();
  });

  it('shows file paths relative to the library root', async () => {
    renderResults();
    expect(await screen.findByText('/snes/a.sfc')).toBeInTheDocument();
  });

  it('toggles a file by its path', async () => {
    const onToggle = vi.fn();
    renderResults({ onToggle });
    await userEvent.click(screen.getAllByRole('checkbox')[1]!);
    expect(onToggle).toHaveBeenCalledWith('/roms/snes/b.sfc');
  });

  it('renames the selected files', async () => {
    const onRename = vi.fn();
    renderResults({ onRename, selected: new Set(['/roms/snes/a.sfc', '/roms/snes/b.sfc']) });
    await userEvent.click(screen.getByRole('button', { name: 'Renommer 2 fichiers' }));
    expect(onRename).toHaveBeenCalledOnce();
  });

  it('cannot rename with nothing selected, or while renaming', () => {
    const { unmount } = renderResults();
    expect(screen.getByRole('button', { name: 'Renommer 0 fichier' })).toBeDisabled();
    unmount();
    renderResults({ selected: new Set(['/roms/snes/a.sfc']), renaming: true });
    expect(screen.getByRole('button', { name: 'Renommage…' })).toBeDisabled();
  });

  it('offers to deselect everything once everything is selected', async () => {
    const onSetAll = vi.fn();
    renderResults({ onSetAll, selected: new Set(['/roms/snes/a.sfc', '/roms/snes/b.sfc']) });
    await userEvent.click(screen.getByRole('button', { name: 'Tout désélectionner' }));
    expect(onSetAll).toHaveBeenCalledWith(false);
  });

  // Regression: it used to toggle each file, so a partial selection got
  // inverted (two of three ticked → one) instead of completed.
  it('selects every file from a partial selection', async () => {
    const onSetAll = vi.fn();
    const onToggle = vi.fn();
    renderResults({ onSetAll, onToggle, selected: new Set(['/roms/snes/a.sfc']) });
    await userEvent.click(screen.getByRole('button', { name: 'Tout sélectionner' }));
    expect(onSetAll).toHaveBeenCalledWith(true);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('cannot select a shared file before its name is picked', async () => {
    const onChoose = vi.fn();
    const onSetAll = vi.fn();
    const shared = { ...wrongName('x.bin'), alternatives: ['Alpha.bin', 'Beta.bin'] };
    renderResults({ result: { ...RESULT, wrongName: [shared] }, onChoose, onSetAll });
    expect(screen.getByRole('checkbox')).toBeDisabled();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'Beta.bin');
    expect(onChoose).toHaveBeenCalledWith('/roms/snes/x.bin', 'Beta.bin');
  });

  it('lists the files that matched nothing', () => {
    renderResults();
    expect(screen.getByText('1 fichier absent du DAT')).toBeInTheDocument();
  });

  it('hides the rename section when every name is already right', () => {
    renderResults({ result: { ...RESULT, wrongName: [] } });
    expect(screen.queryByText('Suggestions de renommage')).not.toBeInTheDocument();
  });

  // A disc game in one .chd matches once per rom of the DAT: it must still
  // read as one game in one file, and be listed.
  it('counts and lists a .chd game once', () => {
    const chd = '/roms/psx/Bloody Roar (USA).chd';
    const match = (romName: string) => ({
      filePath: chd,
      gameName: 'Bloody Roar (USA)',
      romName,
      crc: '1',
    });
    renderResults({
      result: {
        matched: [match('a.cue'), match('a (Track 1).bin'), match('a (Track 2).bin')],
        wrongName: [],
        unmatched: [],
      },
    });
    expect(screen.getByText('jeu trouvé').parentElement).toHaveTextContent('1');
    expect(screen.getByText('1 fichier scanné')).toBeInTheDocument();
    expect(screen.getByText('Voir le jeu trouvé')).toBeInTheDocument();
    expect(screen.getByText('Bloody Roar (USA)')).toBeInTheDocument();
  });
});
