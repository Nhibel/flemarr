import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { sectionId, useOpenSections } from '../use-open-sections.js';

describe('useOpenSections', () => {
  it('starts with the lists that ask for action unfolded', () => {
    const { result } = renderHook(() => useOpenSections());
    expect(result.current.openSections).toEqual({
      found: false,
      wrongName: true,
      linked: true,
      unmatched: false,
    });
  });

  it('changes one list and leaves the others', () => {
    const { result } = renderHook(() => useOpenSections());
    act(() => result.current.setOpen('found', true));
    expect(result.current.openSections).toMatchObject({ found: true, unmatched: false });
  });

  it('keeps the same state when nothing changes', () => {
    const { result } = renderHook(() => useOpenSections());
    const before = result.current.openSections;
    act(() => result.current.setOpen('wrongName', true));
    expect(result.current.openSections).toBe(before);
  });
});

describe('sectionId', () => {
  it('gives each list its own id', () => {
    expect(sectionId('found')).not.toBe(sectionId('linked'));
  });
});
