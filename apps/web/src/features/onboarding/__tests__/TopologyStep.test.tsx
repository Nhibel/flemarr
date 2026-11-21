import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopologyStep } from '../TopologyStep.js';

describe('TopologyStep', () => {
  it('offers the three answers', () => {
    render(<TopologyStep saving={false} onChoose={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  // The answer writes the topology and the download target together.
  it('sends the whole patch of the answer picked', async () => {
    const onChoose = vi.fn();
    render(<TopologyStep saving={false} onChoose={onChoose} />);
    await userEvent.click(screen.getByRole('button', { name: /un serveur, un NAS/ }));
    expect(onChoose).toHaveBeenCalledWith({ topology: 'remote', downloadTarget: 'browser' });
  });

  it('locks the answers while the choice is being saved', () => {
    render(<TopologyStep saving onChoose={() => {}} />);
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });
});
