import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import * as api from '@/lib/api.js';
import type { WrongNameEntry } from '@shared/scan.js';
import { useRenames } from '../use-renames.js';

vi.mock('@/lib/api.js');

function entry(file: string, alternatives?: string[]): WrongNameEntry {
  return {
    filePath: `/psx/${file}`,
    currentName: file,
    canonicalName: `Right ${file}`,
    crc: 'aabbccdd',
    gameName: 'Game',
    alternatives,
  };
}

const ENTRIES = [entry('a.bin'), entry('x.bin', ['Alpha.bin', 'Beta.bin'])];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.requestRenames).mockResolvedValue({
    done: [],
    failed: [],
    skipped: [],
    rolledBack: [],
  });
});

function renderRenames() {
  const onRenamed = vi.fn(async () => {});
  const { result } = renderHook(() => useRenames(ENTRIES, onRenamed));
  return { result, onRenamed };
}

describe('useRenames', () => {
  it('leaves a shared file out of "select all" until its name is picked', () => {
    const { result } = renderRenames();
    act(() => result.current.setAll(true));
    expect([...result.current.selected]).toEqual(['/psx/a.bin']);

    act(() => result.current.choose('/psx/x.bin', 'Beta.bin'));
    act(() => result.current.setAll(true));
    expect(result.current.selected.size).toBe(2);
  });

  it('renames a shared file to the picked name', async () => {
    const { result, onRenamed } = renderRenames();
    act(() => result.current.choose('/psx/x.bin', 'Beta.bin'));
    act(() => result.current.toggle('/psx/x.bin'));
    await act(() => result.current.rename());
    expect(api.requestRenames).toHaveBeenCalledWith({
      renames: [{ from: '/psx/x.bin', to: 'Beta.bin' }],
    });
    expect(onRenamed).toHaveBeenCalledOnce();
  });

  it('deselects a file whose picked name is taken back', () => {
    const { result } = renderRenames();
    act(() => result.current.choose('/psx/x.bin', 'Beta.bin'));
    act(() => result.current.toggle('/psx/x.bin'));
    act(() => result.current.choose('/psx/x.bin', ''));
    expect(result.current.selected.size).toBe(0);
  });

  it('does not rescan after an error', async () => {
    vi.mocked(api.requestRenames).mockRejectedValue(new Error('disque plein'));
    const { result, onRenamed } = renderRenames();
    act(() => result.current.toggle('/psx/a.bin'));
    await act(() => result.current.rename());
    expect(result.current.outcome?.error).toBe('disque plein');
    expect(onRenamed).not.toHaveBeenCalled();
  });
});
