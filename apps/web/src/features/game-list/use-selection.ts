import { useState, useCallback } from 'react';
import type { Game } from '@shared/dat.js';

// In-memory only — intentionally not persisted. GameView stays mounted
// across tab switches, across a visit to Settings (App hides it underneath)
// and under the Lexique popup, so the selection survives those; going back
// to the systems screen unmounts it and the selection is gone, which is the
// desired "don't keep selection across systems" behavior.
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

  // Checks specific games, keeping the rest of the selection.
  const select = useCallback((ids: readonly string[]) => {
    setSelected((prev) => new Set([...prev, ...ids]));
  }, []);

  const clearAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  // Drops specific games from the selection. The downloader uses it to
  // uncheck what it fetched successfully, leaving only what still needs
  // attention checked. Stable identity (no deps) so effects can depend on it.
  const deselect = useCallback((ids: readonly string[]) => {
    setSelected((prev) => {
      if (!ids.some((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const isAllSelected = filteredGames.length > 0 && filteredGames.every((g) => selected.has(g.id));

  return { selected, toggle, selectAll, select, clearAll, deselect, isAllSelected };
}
