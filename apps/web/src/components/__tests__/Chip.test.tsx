import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chip } from '../Chip.js';

describe('Chip', () => {
  it('is plain text without a toggle', () => {
    render(<Chip label="trouvés" count={3} color="green" />);
    expect(screen.getByText('trouvés')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('is a button that says whether its list is unfolded', async () => {
    const onToggle = vi.fn();
    render(
      <Chip
        label="trouvés"
        count={3}
        color="green"
        toggle={{ open: false, controls: 'list', onToggle }}
      />,
    );
    const button = screen.getByRole('button', { name: /3\s*trouvés/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('aria-controls', 'list');
    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
