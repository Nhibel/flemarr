import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppTopBar, APP_TOP_BAR_HEIGHT } from '../AppTopBar.js';

describe('AppTopBar', () => {
  it('holds the logo in a strip of the exported height', () => {
    render(<AppTopBar homeHref="#/" />);
    const bar = screen.getByRole('banner');
    expect(bar).toHaveStyle({ height: APP_TOP_BAR_HEIGHT });
    expect(screen.getByRole('img', { name: 'Flemarr' })).toBeInTheDocument();
  });

  it('makes the logo a link to the home screen', () => {
    render(<AppTopBar homeHref="#/" />);
    const link = screen.getByRole('link', { name: /retour à Mes systèmes/ });
    expect(link).toHaveAttribute('href', '#/');
  });
});
