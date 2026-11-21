import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../use-theme.js';

const STORAGE_KEY = 'flemarr-theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('useTheme', () => {
  it('falls back to light when no OS preference and nothing stored', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('honors a previously stored theme, including the newest ones', () => {
    localStorage.setItem(STORAGE_KEY, 'nightdrive');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('nightdrive');
    expect(document.documentElement.dataset.theme).toBe('nightdrive');
  });

  // A theme that was removed, not a typo: `cyberpunk` shipped and was
  // dropped on 2026-11-18, so a browser that was using it still has the
  // string in localStorage. The same guard covers `nintendo` and
  // `megadrive`, removed on 2026-11-15.
  it('falls back when the stored theme no longer exists', () => {
    localStorage.setItem(STORAGE_KEY, 'cyberpunk');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('honors the matrix and contraste themes', () => {
    localStorage.setItem(STORAGE_KEY, 'contraste');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('contraste');
    expect(document.documentElement.dataset.theme).toBe('contraste');
  });

  // The migration path for anyone who had `nintendo` or `megadrive`
  // selected before those two themes were dropped (2026-11-15). A retired
  // theme must behave exactly like a value that was never valid: fall back,
  // never apply a data-theme no stylesheet defines any more.
  it('falls back to the default when the stored theme has been retired', () => {
    localStorage.setItem(STORAGE_KEY, 'megadrive');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('honors the sonicmania theme', () => {
    localStorage.setItem(STORAGE_KEY, 'sonicmania');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('sonicmania');
    expect(document.documentElement.dataset.theme).toBe('sonicmania');
  });

  it('falls back to the default when the stored value is invalid', () => {
    localStorage.setItem(STORAGE_KEY, 'solarized');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('setTheme updates state, the data-theme attribute, and persists the choice', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('catppuccin'));
    expect(result.current.theme).toBe('catppuccin');
    expect(document.documentElement.dataset.theme).toBe('catppuccin');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('catppuccin');
  });

  it('a fresh mount reads back a theme persisted by a previous one', () => {
    const { result: first } = renderHook(() => useTheme());
    act(() => first.current.setTheme('dark'));

    const { result: second } = renderHook(() => useTheme());
    expect(second.current.theme).toBe('dark');
  });
});
