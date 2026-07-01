import { randomUUID } from 'node:crypto';
import type { DatFile, DatSummary } from '@shared/dat.js';

const store = new Map<string, DatFile>();

export function addDat(dat: DatFile): DatSummary {
  const id = randomUUID();
  store.set(id, dat);
  return {
    id,
    system: dat.system,
    gameCount: dat.games.length,
    source: dat.source,
  };
}

export function getDat(id: string): DatFile | undefined {
  return store.get(id);
}

export function listDats(): Array<DatSummary & { id: string }> {
  return Array.from(store.entries()).map(([id, dat]) => ({
    id,
    system: dat.system,
    gameCount: dat.games.length,
    source: dat.source,
  }));
}
