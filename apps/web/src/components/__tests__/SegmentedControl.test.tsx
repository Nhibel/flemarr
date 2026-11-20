import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from '../SegmentedControl.js';

const OPTIONS = [
  { value: 'games', label: 'Jeux' },
  { value: 'sources', label: 'Sources' },
] as const;

describe('SegmentedControl', () => {
  it('marks only the current value as pressed', () => {
    render(<SegmentedControl options={OPTIONS} value="sources" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Sources' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Jeux' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the clicked value', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={OPTIONS} value="games" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Sources' }));

    expect(onChange).toHaveBeenCalledWith('sources');
  });
});
