import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './use-theme.js';

const STORAGE_KEY = 'rom-curator-theme';

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

  it('honors a previously stored theme, including catppuccin/cyberpunk', () => {
    localStorage.setItem(STORAGE_KEY, 'cyberpunk');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('cyberpunk');
    expect(document.documentElement.dataset.theme).toBe('cyberpunk');
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
