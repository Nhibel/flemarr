import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SystemIcon } from './SystemIcon.js';

const SNES = 'Nintendo - Super Nintendo Entertainment System';

describe('SystemIcon', () => {
  it('shows the colour icon as an image, through the backend proxy', () => {
    const { container } = render(<SystemIcon system={SNES} style="systematic" size={40} />);
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe(
      '/api/systems/icon?system=Nintendo%20-%20Super%20Nintendo%20Entertainment%20System',
    );
    // Decoration next to the name it illustrates: no alt text to read out.
    expect(img?.getAttribute('alt')).toBe('');
  });

  it('masks the silhouette instead of showing it, so a theme colour fills it', () => {
    const { container } = render(<SystemIcon system={SNES} style="monochrome" size={40} />);
    expect(container.querySelector('img')).toBeNull();
    const span = container.querySelector('span');
    expect(span?.style.maskImage).toContain('/api/systems/icon?system=');
    expect(span?.style.maskSize).toBe('contain');
  });

  it('falls back to the initial when no icon covers the system', () => {
    render(<SystemIcon system="Video CD" style={null} size={40} />);
    expect(screen.getByText('V')).toBeTruthy();
  });

  it('shows the same placeholder while the lookup is still in flight', () => {
    render(<SystemIcon system="Video CD" style={undefined} size={40} />);
    expect(screen.getByText('V')).toBeTruthy();
  });

  it('is square at the size asked for', () => {
    const { container } = render(<SystemIcon system={SNES} style="systematic" size={36} />);
    const img = container.querySelector('img');
    expect(img?.style.width).toBe('36px');
    expect(img?.style.height).toBe('36px');
  });
});
