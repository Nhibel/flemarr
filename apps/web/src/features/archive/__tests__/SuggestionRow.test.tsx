import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SuggestionRow } from '../SuggestionRow.js';

const SUGGESTION = {
  identifier: 'ni-roms',
  title: 'No-Intro ROMs',
  layout: 'zip-collection' as const,
  fileCount: 1,
  coverage: 0.9,
  crcCoverage: 0.6,
  sampleSize: 1,
};

describe('SuggestionRow', () => {
  it('splits the coverage into its CRC-verified and name-only parts', () => {
    render(<SuggestionRow suggestion={SUGGESTION} onAdopt={async () => {}} />);
    expect(screen.getByText('60 % CRC vérifié')).toBeInTheDocument();
    expect(screen.getByText(/\+ 30 % nom seul/)).toBeInTheDocument();
  });

  it('says nothing of name-only matches when every match is CRC-verified', () => {
    render(
      <SuggestionRow suggestion={{ ...SUGGESTION, coverage: 0.6 }} onAdopt={async () => {}} />,
    );
    expect(screen.queryByText(/nom seul/)).not.toBeInTheDocument();
  });

  it('keeps one game and one file singular', () => {
    render(<SuggestionRow suggestion={SUGGESTION} onAdopt={async () => {}} />);
    expect(screen.getByText(/échantillon de 1 jeu\)/)).toBeInTheDocument();
    expect(screen.getByText(/1 fichier dans/)).toBeInTheDocument();
  });

  it('adopts on click', async () => {
    const onAdopt = vi.fn(async () => {});
    render(<SuggestionRow suggestion={SUGGESTION} onAdopt={onAdopt} />);
    await userEvent.click(screen.getByRole('button', { name: 'Adopter' }));
    expect(onAdopt).toHaveBeenCalledOnce();
  });

  it('shows a failed adoption and lets it be retried', async () => {
    const onAdopt = vi.fn(async () => {
      throw new Error('Item introuvable');
    });
    render(<SuggestionRow suggestion={SUGGESTION} onAdopt={onAdopt} />);
    await userEvent.click(screen.getByRole('button', { name: 'Adopter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Item introuvable');
    expect(screen.getByRole('button', { name: 'Adopter' })).toBeEnabled();
  });

  it('offers no button for a source already configured', () => {
    render(<SuggestionRow suggestion={SUGGESTION} onAdopt={async () => {}} configured />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('✓ Déjà ajoutée')).toBeInTheDocument();
  });
});
