import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useFontScale,
  DEFAULT_FONT_SCALE,
  MIN_FONT_SCALE,
  MAX_FONT_SCALE,
} from '../use-font-scale.js';

const STORAGE_KEY = 'flemarr-font-scale';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.style.removeProperty('--font-scale');
});

describe('useFontScale', () => {
  it('falls back to the default when nothing is stored', () => {
    const { result } = renderHook(() => useFontScale());
    expect(result.current.fontScale).toBe(DEFAULT_FONT_SCALE);
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe(
      `${DEFAULT_FONT_SCALE}px`,
    );
  });

  it('honors a previously stored value', () => {
    localStorage.setItem(STORAGE_KEY, '20');
    const { result } = renderHook(() => useFontScale());
    expect(result.current.fontScale).toBe(20);
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('20px');
  });

  it('falls back to the default when the stored value is not a number', () => {
    localStorage.setItem(STORAGE_KEY, 'huge');
    const { result } = renderHook(() => useFontScale());
    expect(result.current.fontScale).toBe(DEFAULT_FONT_SCALE);
  });

  it('clamps a stored value above the maximum', () => {
    localStorage.setItem(STORAGE_KEY, '999');
    const { result } = renderHook(() => useFontScale());
    expect(result.current.fontScale).toBe(MAX_FONT_SCALE);
  });

  it('clamps a stored value below the minimum', () => {
    localStorage.setItem(STORAGE_KEY, '0');
    const { result } = renderHook(() => useFontScale());
    expect(result.current.fontScale).toBe(MIN_FONT_SCALE);
  });

  it('setFontScale updates state, the CSS variable, and persists the choice', () => {
    const { result } = renderHook(() => useFontScale());
    act(() => result.current.setFontScale(22));
    expect(result.current.fontScale).toBe(22);
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('22px');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('22');
  });

  it('setFontScale clamps a value past the bounds instead of applying it as-is', () => {
    const { result } = renderHook(() => useFontScale());
    act(() => result.current.setFontScale(1000));
    expect(result.current.fontScale).toBe(MAX_FONT_SCALE);
  });

  it('a fresh mount reads back a value persisted by a previous one', () => {
    const { result: first } = renderHook(() => useFontScale());
    act(() => first.current.setFontScale(16));

    const { result: second } = renderHook(() => useFontScale());
    expect(second.current.fontScale).toBe(16);
  });
});
