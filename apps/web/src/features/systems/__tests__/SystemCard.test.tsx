import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SystemCard } from '../SystemCard.js';

const DAT = {
  id: 'dat1',
  system: 'Sony - PlayStation',
  gameCount: 1,
  source: 'redump' as const,
};

function renderCard(overrides: Partial<Parameters<typeof SystemCard>[0]> = {}) {
  const props = {
    dat: DAT,
    iconStyle: null,
    removing: false,
    onOpen: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
  render(<SystemCard {...props} />);
  return props;
}

describe('SystemCard', () => {
  it('shows the system, its source and a singular game count', () => {
    renderCard();
    expect(screen.getByText('Sony - PlayStation')).toBeInTheDocument();
    expect(screen.getByText('redump · 1 jeu')).toBeInTheDocument();
  });

  it('opens the system from the card', async () => {
    const { onOpen, onRemove } = renderCard();
    await userEvent.click(screen.getByText('Sony - PlayStation'));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('removes it from the ✕, without opening it', async () => {
    const { onOpen, onRemove } = renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Retirer Sony - PlayStation' }));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('locks the ✕ while a removal runs', () => {
    renderCard({ removing: true });
    expect(screen.getByRole('button', { name: 'Retirer Sony - PlayStation' })).toBeDisabled();
  });
});

describe('SystemCard — newer set version', () => {
  it('says nothing while the set is current', () => {
    renderCard();
    expect(screen.queryByRole('button', { name: 'Mettre à jour' })).not.toBeInTheDocument();
  });

  it('offers the newer version, apart from opening the system', async () => {
    const { onUpdate, onOpen } = renderCard({ newVersion: '20261120-000000', onUpdate: vi.fn() });
    expect(screen.getByText('Nouvelle version du set : 20261120-000000')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mettre à jour' }));
    expect(onUpdate).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('locks the button while the update loads', () => {
    renderCard({ newVersion: 'v2', onUpdate: vi.fn(), updating: true });
    expect(screen.getByRole('button', { name: 'Mise à jour…' })).toBeDisabled();
  });
});
