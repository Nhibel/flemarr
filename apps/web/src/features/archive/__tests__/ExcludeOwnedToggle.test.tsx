import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExcludeOwnedToggle } from '../ExcludeOwnedToggle.js';

describe('ExcludeOwnedToggle', () => {
  it('says how many selected games are owned', () => {
    render(<ExcludeOwnedToggle checked onChange={() => {}} ownedCount={2} selectedCount={5} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText(/2 sur 5 possédés/)).toBeInTheDocument();
  });

  it('uses the singular for one owned game', () => {
    render(<ExcludeOwnedToggle checked onChange={() => {}} ownedCount={1} selectedCount={5} />);
    expect(screen.getByText(/1 sur 5 possédé\)/)).toBeInTheDocument();
  });

  it('reports the new state when toggled', async () => {
    const onChange = vi.fn();
    render(<ExcludeOwnedToggle checked onChange={onChange} ownedCount={2} selectedCount={5} />);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
