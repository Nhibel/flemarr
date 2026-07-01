import { useState, useCallback } from 'react';
import type { Game } from '@shared/dat.js';

function storageKey(datId: string) {
  return `rom-curator.selection.${datId}`;
}

function loadFromStorage(datId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(datId));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function saveToStorage(datId: string, selected: Set<string>) {
  try {
    localStorage.setItem(storageKey(datId), JSON.stringify([...selected]));
  } catch {
    // storage quota exceeded — silently ignore
  }
}

export function useSelection(datId: string, filteredGames: Game[]) {
  const [selected, setSelected] = useState<Set<string>>(() => loadFromStorage(datId));

  const update = useCallback(
    (next: Set<string>) => {
      setSelected(next);
      saveToStorage(datId, next);
    },
    [datId],
  );

  const toggle = useCallback(
    (id: string) => {
      update(
        selected.has(id)
          ? new Set([...selected].filter((x) => x !== id))
          : new Set([...selected, id]),
      );
    },
    [selected, update],
  );

  const selectAll = useCallback(() => {
    update(new Set([...selected, ...filteredGames.map((g) => g.id)]));
  }, [selected, filteredGames, update]);

  const clearAll = useCallback(() => {
    update(new Set());
  }, [update]);

  const isAllSelected = filteredGames.length > 0 && filteredGames.every((g) => selected.has(g.id));

  return { selected, toggle, selectAll, clearAll, isAllSelected };
}
