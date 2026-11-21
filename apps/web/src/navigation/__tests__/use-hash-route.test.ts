import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useHashRoute } from '../use-hash-route.js';

beforeEach(() => {
  window.location.hash = '';
});

describe('useHashRoute', () => {
  it('starts from the hash in the URL', () => {
    window.location.hash = '#/settings';
    const { result } = renderHook(() => useHashRoute());
    expect(result.current.route).toEqual({ screen: 'settings' });
  });

  it('writes a navigation to the hash', () => {
    const { result } = renderHook(() => useHashRoute());
    act(() => result.current.navigate({ screen: 'game', datId: 'd1', tab: 'scanner' }));
    expect(window.location.hash).toBe('#/systems/d1/scanner');
    expect(result.current.route).toMatchObject({ datId: 'd1', tab: 'scanner' });
  });

  // The browser's back button changes the hash on its own.
  it('follows a hash changed from outside', async () => {
    const { result } = renderHook(() => useHashRoute());
    act(() => {
      window.location.hash = '#/settings';
    });
    await waitFor(() => expect(result.current.route).toEqual({ screen: 'settings' }));
  });
});
