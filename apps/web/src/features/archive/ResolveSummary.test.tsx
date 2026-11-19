import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResolveSummary } from './ResolveSummary.js';

const PROPS: ComponentProps<typeof ResolveSummary> = {
  summary: { complete: 2, partial: 1, notFound: 4, downloadableCount: 5 },
  destination: '→ /snes',
  queuing: false,
  canDownload: true,
  onDownload: () => {},
};

function renderSummary(over: Partial<ComponentProps<typeof ResolveSummary>> = {}) {
  return render(<ResolveSummary {...PROPS} {...over} />);
}

describe('ResolveSummary', () => {
  it('shows the counts per outcome', () => {
    renderSummary();
    expect(screen.getByText('Complets').parentElement).toHaveTextContent('2');
    expect(screen.getByText('Partiels').parentElement).toHaveTextContent('1');
    expect(screen.getByText('Introuvables').parentElement).toHaveTextContent('4');
  });

  it('offers to download the found files, and says where they go', async () => {
    const onDownload = vi.fn();
    renderSummary({ onDownload });
    await userEvent.click(screen.getByRole('button', { name: 'Télécharger (5 fichiers)' }));
    expect(onDownload).toHaveBeenCalledOnce();
    expect(screen.getByText('→ /snes')).toBeInTheDocument();
  });

  it('uses the singular for one file', () => {
    renderSummary({ summary: { ...PROPS.summary, downloadableCount: 1 } });
    expect(screen.getByRole('button', { name: 'Télécharger (1 fichier)' })).toBeInTheDocument();
  });

  it('hides the button when nothing was found', () => {
    renderSummary({ summary: { complete: 0, partial: 0, notFound: 3, downloadableCount: 0 } });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('disables the button when the download is blocked', () => {
    renderSummary({ canDownload: false });
    expect(screen.getByRole('button', { name: /télécharger/i })).toBeDisabled();
  });

  it('shows progress while the job is being queued', () => {
    renderSummary({ queuing: true, canDownload: false });
    expect(screen.getByRole('button', { name: 'Lancement…' })).toBeDisabled();
  });
});
