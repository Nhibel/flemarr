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
  it('shows no checkbox when there is nothing to choose', () => {
    render(<SourceRow source={SOURCE} onRemove={() => {}} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('ticks the source for the next resolve', async () => {
    const onTogglePicked = vi.fn();
    render(<SourceRow source={SOURCE} onRemove={() => {}} onTogglePicked={onTogglePicked} />);
    const box = screen.getByRole('checkbox', { name: 'Chercher dans sony_playstation_part3' });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(onTogglePicked).toHaveBeenCalledOnce();
  });

  it('shows the source as ticked', () => {
    render(<SourceRow source={SOURCE} onRemove={() => {}} picked onTogglePicked={() => {}} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
