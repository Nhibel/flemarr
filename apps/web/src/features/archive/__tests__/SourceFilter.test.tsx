import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SourceFilter } from '../SourceFilter.js';

const SOURCES = ['sony_playstation_part1', 'sony_playstation_part2', 'rr-sony-playstation-u'];

describe('SourceFilter', () => {
  it('says every source is searched while none is ticked', () => {
    render(<SourceFilter sources={SOURCES} picked={[]} onToggle={() => {}} />);
    expect(screen.getByText(/toutes les sources/)).toBeInTheDocument();
    for (const box of screen.getAllByRole('checkbox')) expect(box).not.toBeChecked();
  });

  it('counts the ticked sources', () => {
    render(
      <SourceFilter sources={SOURCES} picked={['sony_playstation_part2']} onToggle={() => {}} />,
    );
    expect(screen.getByText('— 1 sur 3')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'sony_playstation_part2' })).toBeChecked();
  });

  it('reports which source was toggled', async () => {
    const onToggle = vi.fn();
    render(<SourceFilter sources={SOURCES} picked={[]} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'rr-sony-playstation-u' }));
    expect(onToggle).toHaveBeenCalledWith('rr-sony-playstation-u');
  });
});
