import { useState, useCallback } from 'react';
import type { Game } from '@shared/dat.js';

// In-memory only — intentionally not persisted. GameView keeps this hook's
// component mounted across tab switches (games/scanner/sources/downloads),
// so selection survives those; leaving GameView (reset to loader, or to
// settings and back) unmounts it and the selection is gone, which is the
// desired "don't keep selection across screens" behavior.
export function useSelection(filteredGames: Game[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected((prev) => new Set([...prev, ...filteredGames.map((g) => g.id)]));
  }, [filteredGames]);

  const clearAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const isAllSelected = filteredGames.length > 0 && filteredGames.every((g) => selected.has(g.id));

  return { selected, toggle, selectAll, clearAll, isAllSelected };
}
