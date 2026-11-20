import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '../Switch.js';

describe('Switch', () => {
  it('is announced as a switch, with its state', () => {
    render(<Switch checked label="Chercher ici" onChange={() => {}} />);
    expect(screen.getByRole('switch', { name: 'Chercher ici' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('reports the opposite state when clicked', async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} label="Chercher ici" onChange={onChange} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('toggles from the keyboard', async () => {
    const onChange = vi.fn();
    render(<Switch checked label="Chercher ici" onChange={onChange} />);
    screen.getByRole('switch').focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('takes a distinct accessible name when labels repeat', () => {
    render(
      <Switch
        checked={false}
        label="Chercher ici"
        ariaLabel="Chercher dans psx"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('switch', { name: 'Chercher dans psx' })).toBeInTheDocument();
  });
});
