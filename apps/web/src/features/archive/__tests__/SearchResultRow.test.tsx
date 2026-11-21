import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchResultRow } from '../SearchResultRow.js';

const RESULT = {
  identifier: 'psx-a-c',
  title: 'PlayStation A–C',
  description: '',
};

describe('SearchResultRow', () => {
  it('shows the title under the identifier', () => {
    render(<SearchResultRow result={RESULT} onAdd={async () => {}} />);
    expect(screen.getByText('psx-a-c')).toBeInTheDocument();
    expect(screen.getByText('PlayStation A–C')).toBeInTheDocument();
  });

  it('does not repeat a title equal to the identifier', () => {
    render(<SearchResultRow result={{ ...RESULT, title: 'psx-a-c' }} onAdd={async () => {}} />);
    expect(screen.getAllByText('psx-a-c')).toHaveLength(1);
  });

  it('adds the item with its title as note', async () => {
    const onAdd = vi.fn(async () => {});
    render(<SearchResultRow result={RESULT} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(onAdd).toHaveBeenCalledWith('psx-a-c', 'PlayStation A–C');
  });

  it('shows a failed add and lets it be retried', async () => {
    const onAdd = vi.fn(async () => {
      throw new Error('Déjà présente');
    });
    render(<SearchResultRow result={RESULT} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Déjà présente');
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeEnabled();
  });

  it('offers no button for a source already configured', () => {
    render(<SearchResultRow result={RESULT} onAdd={async () => {}} configured />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
