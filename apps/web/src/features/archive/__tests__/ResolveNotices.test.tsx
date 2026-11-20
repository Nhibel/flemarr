import { describe, it, expect } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { ResolveNotices } from '../ResolveNotices.js';

const READY: ComponentProps<typeof ResolveNotices> = {
  hasSources: true,
  selectedCount: 3,
  toResolveCount: 3,
  hasNoFolder: false,
  isStale: false,
  error: null,
};

function renderNotices(over: Partial<ComponentProps<typeof ResolveNotices>> = {}) {
  return render(<ResolveNotices {...READY} {...over} />);
}

describe('ResolveNotices', () => {
  it('shows nothing when a resolve can run', () => {
    const { container } = renderNotices();
    expect(container).toBeEmptyDOMElement();
  });

  it('asks for a source first, and only that, when there is none', () => {
    renderNotices({ hasSources: false, selectedCount: 0, toResolveCount: 0 });
    expect(screen.getByText(/ajoute au moins une source/i)).toBeInTheDocument();
    expect(screen.queryByText(/sélectionne des jeux/i)).not.toBeInTheDocument();
  });

  it('says to switch a source back on when all are off', () => {
    renderNotices({ hasNoActiveSource: true });
    expect(screen.getByText(/toutes les sources sont désactivées/i)).toBeInTheDocument();
  });

  it('asks for a selection once sources exist', () => {
    renderNotices({ selectedCount: 0, toResolveCount: 0 });
    expect(screen.getByText(/sélectionne des jeux/i)).toBeInTheDocument();
  });

  it('says there is nothing to download when every selected game is owned', () => {
    renderNotices({ toResolveCount: 0 });
    expect(screen.getByText(/déjà présents sur le disque/i)).toBeInTheDocument();
  });

  it('warns about a missing system folder', () => {
    renderNotices({ hasNoFolder: true });
    expect(screen.getByText(/aucun dossier défini/i)).toBeInTheDocument();
  });

  it('warns about stale results', () => {
    renderNotices({ isStale: true });
    expect(screen.getByText(/les sources ont changé/i)).toBeInTheDocument();
  });

  it('announces the error', () => {
    renderNotices({ error: 'Résolution impossible' });
    expect(screen.getByRole('alert')).toHaveTextContent('Résolution impossible');
  });
});
