import { useCallback, useState } from 'react';
import { requestRenames } from '@/lib/api.js';
import type { RenameResult, WrongNameEntry } from '@shared/scan.js';

export interface RenameOutcome {
  done: number;
  failed: number;
  /** Left alone: another file already has the name. */
  skipped: RenameResult['skipped'];
  error?: string;
}

/** The name a file would get; undefined while the user still has to pick one. */
export function chosenName(
  entry: WrongNameEntry,
  choices: ReadonlyMap<string, string>,
): string | undefined {
  if (entry.alternatives === undefined) return entry.canonicalName;
  return choices.get(entry.filePath);
}

/**
 * The misnamed files picked for renaming, and the last rename's outcome. The
 * outcome outlives the rescan that follows, so skipped files stay explained.
 */
export function useRenames(entries: WrongNameEntry[], onRenamed: () => Promise<void>) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [choices, setChoices] = useState<Map<string, string>>(new Map());
  const [renaming, setRenaming] = useState(false);
  const [outcome, setOutcome] = useState<RenameOutcome | null>(null);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setChoices(new Map());
  }, []);

  const clearOutcome = useCallback(() => setOutcome(null), []);

  const toggle = useCallback((filePath: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return next;
    });
  }, []);

  // Not a toggle per file: with some already ticked, toggling each one
  // inverted the selection instead of completing it.
  const setAll = useCallback(
    (selectAll: boolean) => {
      const ready = entries.filter((entry) => chosenName(entry, choices) !== undefined);
      setSelected(new Set(selectAll ? ready.map((entry) => entry.filePath) : []));
    },
    [entries, choices],
  );

  const choose = useCallback((filePath: string, name: string) => {
    setChoices((previous) => {
      const next = new Map(previous);
      if (name === '') next.delete(filePath);
      else next.set(filePath, name);
      return next;
    });
    if (name !== '') return;
    setSelected((previous) => new Set([...previous].filter((path) => path !== filePath)));
  }, []);

  const rename = useCallback(async () => {
    const renames: { from: string; to: string }[] = [];
    for (const entry of entries) {
      const to = chosenName(entry, choices);
      if (selected.has(entry.filePath) && to !== undefined) {
        renames.push({ from: entry.filePath, to });
      }
    }
    if (renames.length === 0) return;

    setRenaming(true);
    try {
      const { done, failed, skipped } = await requestRenames({ renames });
      setOutcome({ done: done.length, failed: failed.length, skipped });
      await onRenamed();
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Échec du renommage';
      setOutcome({ done: 0, failed: 0, skipped: [], error });
    } finally {
      setRenaming(false);
    }
  }, [entries, choices, selected, onRenamed]);

  return {
    selected,
    choices,
    renaming,
    outcome,
    toggle,
    setAll,
    choose,
    rename,
    clearSelection,
    clearOutcome,
  };
}
