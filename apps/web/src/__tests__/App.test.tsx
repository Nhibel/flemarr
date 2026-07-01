import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../App.js';

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe('App', () => {
  it('renders the heading and mode toggle on initial load', () => {
    render(<App />, { wrapper });
    expect(screen.getByRole('heading', { name: /rom-curator/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fresh1g1r/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /manuel/i })).toBeInTheDocument();
  });
});
