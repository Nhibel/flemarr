import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Foldable } from '../Foldable.js';

function renderFoldable(open: boolean, onOpenChange: (open: boolean) => void) {
  const { container } = render(
    <Foldable id="list" summary="Liste" open={open} onOpenChange={onOpenChange}>
      <p>contenu</p>
    </Foldable>,
  );
  const details = container.querySelector('details');
  if (details === null) throw new Error('no <details>');
  return details;
}

describe('Foldable', () => {
  it('follows the open state of its parent', () => {
    const details = renderFoldable(true, vi.fn());
    expect(details.open).toBe(true);
    expect(details.id).toBe('list');
    expect(screen.getByText('contenu')).toBeVisible();
  });

  it('reports a fold made on the element itself', () => {
    const onOpenChange = vi.fn();
    const details = renderFoldable(true, onOpenChange);
    details.open = false;
    fireEvent(details, new Event('toggle'));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
