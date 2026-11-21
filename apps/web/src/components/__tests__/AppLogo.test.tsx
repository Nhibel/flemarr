import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppLogo } from '../AppLogo.js';

describe('AppLogo', () => {
  it('renders the wordmark as an image named after the app, at the given height', () => {
    render(<AppLogo height={32} />);
    const logo = screen.getByRole('img', { name: 'Flemarr' });
    // Inline style, not an attribute: Panda's preflight `height: auto` would
    // override an attribute and let the logo stretch to the page width. The
    // height follows from the width through the drawing's aspect ratio.
    expect(logo).toHaveStyle({ width: '124px', maxWidth: '100%' });
    expect(logo.getAttribute('src')).toMatch(/logo\.svg/);
  });
});
