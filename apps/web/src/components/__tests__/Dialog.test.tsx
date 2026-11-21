import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from '../Dialog.js';

function renderDialog(open: boolean, onClose = vi.fn()) {
  const view = render(
    <Dialog open={open} onClose={onClose} title="Ajouter un système">
      <p>Contenu</p>
    </Dialog>,
  );
  return { ...view, onClose };
}

describe('Dialog', () => {
  it('opens with its title and content', () => {
    renderDialog(true);
    const dialog = screen.getByRole('dialog', { name: 'Ajouter un système' });
    expect(dialog).toHaveAttribute('open');
    expect(screen.getByText('Contenu')).toBeInTheDocument();
  });

  it('stays closed while not open', () => {
    const { container } = renderDialog(false);
    expect(container.querySelector('dialog')).not.toHaveAttribute('open');
  });

  it('closes again when open turns false', () => {
    const { container, rerender, onClose } = renderDialog(true);
    rerender(
      <Dialog open={false} onClose={onClose} title="Ajouter un système">
        <p>Contenu</p>
      </Dialog>,
    );
    expect(container.querySelector('dialog')).not.toHaveAttribute('open');
  });

  it('asks to close from the ✕ button', async () => {
    const { onClose } = renderDialog(true);
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalled();
  });

  // Escape fires `cancel`: the parent decides, the element does not close itself.
  it('routes Escape through onClose', () => {
    const { onClose } = renderDialog(true);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on a backdrop click, not on a click inside', async () => {
    const { onClose } = renderDialog(true);
    await userEvent.click(screen.getByText('Contenu'));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });
});
