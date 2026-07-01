import type { ArchiveSource } from '@shared/archive.js';

// Mutable in-memory store — persisted to SQLite in phase 7.
// Keyed by the exact system string from the DAT header (e.g. "Nintendo - Super Nintendo Entertainment System").
const store = new Map<string, ArchiveSource[]>();

export function getSources(system: string): ArchiveSource[] {
  return store.get(system) ?? [];
}

export function getAllSystems(): string[] {
  return [...store.keys()];
}

export function addSource(system: string, source: ArchiveSource): void {
  const existing = store.get(system) ?? [];
  const alreadyExists = existing.some((s) => s.identifier === source.identifier);
  if (!alreadyExists) {
    store.set(system, [...existing, source]);
  }
}

export function removeSource(identifier: string): boolean {
  let removed = false;
  for (const [system, sources] of store.entries()) {
    const next = sources.filter((s) => s.identifier !== identifier);
    if (next.length !== sources.length) {
      if (next.length === 0) store.delete(system);
      else store.set(system, next);
      removed = true;
    }
  }
  return removed;
}

export function findSystemForIdentifier(identifier: string): string | undefined {
  for (const [system, sources] of store.entries()) {
    if (sources.some((s) => s.identifier === identifier)) return system;
  }
  return undefined;
}
