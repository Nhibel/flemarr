import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DatUploadResponse } from '@shared/api.js';
import { GameHeader } from '../GameHeader.js';
import { scanTimeLabel } from '../scan-time-label.js';

const DAT: DatUploadResponse = {
  id: 'dat1',
  system: 'Nintendo - Super Nintendo Entertainment System',
  source: 'no-intro',
  gameCount: 1401,
};

const PROPS: ComponentProps<typeof GameHeader> = {
  dat: DAT,
  iconStyle: null,
  ownedCount: null,
  lastScanAt: null,
  showScanner: true,
  onScan: () => {},
  onReset: () => {},
  onLexique: () => {},
  onSettings: () => {},
};

function renderHeader(over: Partial<ComponentProps<typeof GameHeader>> = {}) {
  return render(<GameHeader {...PROPS} {...over} />);
}

describe('GameHeader', () => {
  it('names the system, in full on hover too', () => {
    renderHeader();
    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveTextContent(DAT.system);
    expect(title).toHaveAttribute('title', DAT.system);
  });

  // Before a scan the app doesn't know what is owned: no "0 sur ton disque".
  it('says ownership is unknown before a scan', () => {
    renderHeader();
    expect(screen.getByText('no-intro · 1401 jeux · possession inconnue')).toBeInTheDocument();
    expect(screen.queryByText(/sur ton disque/)).not.toBeInTheDocument();
  });

  it('counts owned and missing games after a scan', () => {
    renderHeader({ ownedCount: 1400 });
    expect(screen.getByText('1400 sur ton disque')).toBeInTheDocument();
    expect(screen.getByText('1 manquant sur 1401')).toBeInTheDocument();
  });

  it('says when the last scan ran', () => {
    const lastScanAt = new Date(2026, 10, 19, 14, 30);
    renderHeader({ ownedCount: 3, lastScanAt });
    expect(screen.getByText(scanTimeLabel(lastScanAt))).toBeInTheDocument();
  });

  it('offers a first scan, then a rescan', () => {
    const { unmount } = renderHeader();
    expect(screen.getByRole('button', { name: 'Scanner mon dossier' })).toBeInTheDocument();
    unmount();
    renderHeader({ ownedCount: 3 });
    expect(screen.getByRole('button', { name: 'Rescanner mon dossier' })).toBeInTheDocument();
  });

  it('hides the scan button where no scan can run', () => {
    renderHeader({ showScanner: false });
    expect(screen.queryByRole('button', { name: /scanner mon dossier/i })).not.toBeInTheDocument();
  });

  it('wires each navigation button', async () => {
    const handlers = {
      onScan: vi.fn(),
      onReset: vi.fn(),
      onLexique: vi.fn(),
      onSettings: vi.fn(),
    };
    renderHeader(handlers);
    await userEvent.click(screen.getByRole('button', { name: 'Scanner mon dossier' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mes systèmes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lexique' }));
    await userEvent.click(screen.getByRole('button', { name: 'Paramètres' }));
    for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalledOnce();
  });
});
