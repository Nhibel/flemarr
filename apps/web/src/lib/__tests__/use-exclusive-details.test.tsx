import { describe, it, expect } from 'vitest';
import { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useExclusiveDetails } from '../use-exclusive-details.js';

function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  useExclusiveDetails(ref);
  return (
    <div>
      <div ref={ref}>
        <details data-testid="a">
          <summary>Menu A</summary>
          <button type="button">inside A</button>
        </details>
        <details data-testid="b">
          <summary>Menu B</summary>
          <button type="button">inside B</button>
        </details>
      </div>
      <button type="button">outside</button>
    </div>
  );
}

const open = (id: string) => (screen.getByTestId(id) as HTMLDetailsElement).open;

describe('useExclusiveDetails', () => {
  it('opening one closes the other', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText('Menu A'));
    expect(open('a')).toBe(true);

    await user.click(screen.getByText('Menu B'));
    expect(open('b')).toBe(true);
    expect(open('a')).toBe(false);
  });

  it('a click inside the open menu leaves it open', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText('Menu A'));
    await user.click(screen.getByText('inside A'));
    expect(open('a')).toBe(true);
  });

  it('a click outside every menu closes them', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText('Menu A'));
    await user.click(screen.getByText('outside'));
    expect(open('a')).toBe(false);
  });

  it('Escape closes the open menu', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText('Menu A'));
    await user.keyboard('{Escape}');
    expect(open('a')).toBe(false);
  });

  // Clicking a summary again is the native close. The hook must not fight
  // it by reopening or by leaving the element in a half state.
  it('clicking the same summary twice closes it', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText('Menu A'));
    await user.click(screen.getByText('Menu A'));
    expect(open('a')).toBe(false);
    expect(open('b')).toBe(false);
  });
});
