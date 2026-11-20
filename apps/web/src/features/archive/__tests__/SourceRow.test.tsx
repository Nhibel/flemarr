import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SourceRow } from '../SourceRow.js';

vi.mock('@/lib/api.js');

const SOURCE = {
  identifier: 'sony_playstation_part3',
  layout: 'zip-collection' as const,
  note: '',
};

describe('SourceRow — search pick', () => {
  it('shows no switch when there is nothing to choose', () => {
    render(<SourceRow source={SOURCE} onRemove={() => {}} />);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('is on by default, and reports a toggle', async () => {
    const onToggleSearched = vi.fn();
    render(<SourceRow source={SOURCE} onRemove={() => {}} onToggleSearched={onToggleSearched} />);
    const toggle = screen.getByRole('switch', { name: 'Chercher dans sony_playstation_part3' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(toggle);
    expect(onToggleSearched).toHaveBeenCalledOnce();
  });

  it('shows a switched-off source as off', () => {
    render(
      <SourceRow
        source={SOURCE}
        onRemove={() => {}}
        searched={false}
        onToggleSearched={() => {}}
      />,
    );
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });
});
