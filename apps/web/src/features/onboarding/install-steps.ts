import type { Topology } from './topology.js';

/**
 * The install flow's sequence, as data.
 *
 * Which steps exist depends on the answer to the first one, so the sequence
 * cannot be a fixed array in the component: in `remote` mode the server
 * cannot read the collection, so asking for a folder would be asking for
 * something it can do nothing with. The flow is three steps there, not four
 * with one greyed out.
 *
 * Pure, because the numbering is the part that goes wrong: a skipped step
 * must not leave a hole ("Étape 2 sur 4" with no step 3 reachable), and
 * going back from the sources must land on the console, not on a folder
 * step that was never shown.
 */

export type StepId = 'topology' | 'console' | 'folder' | 'sources';

export const STEP_LABELS: Record<StepId, string> = {
  topology: 'Machine',
  console: 'Console',
  folder: 'Dossier',
  sources: 'Sources',
};

export const STEP_TITLES: Record<StepId, string> = {
  topology: 'Où vivent tes jeux ?',
  console: 'Quelle console veux-tu collectionner ?',
  folder: 'Le dossier de ta collection',
  sources: 'Où chercher les jeux',
};

/**
 * `topology` is undefined before it has been answered — the first run has to
 * show the question before it can know whether the folder step applies, so
 * the full four-step sequence is assumed until the answer arrives. It only
 * ever shortens, never lengthens, so the step count never grows under the
 * user mid-flow.
 */
export function stepsFor(topology: Topology | undefined, opts: { skipTopology?: boolean } = {}) {
  const steps: StepId[] = [];
  if (opts.skipTopology !== true) steps.push('topology');
  steps.push('console');
  // 'local' and 'mounted' both mean the server can reach the collection.
  if (topology === undefined || topology !== 'remote') steps.push('folder');
  steps.push('sources');
  return steps;
}

export interface StepPosition {
  id: StepId;
  /** 1-based, over the steps that actually exist. */
  number: number;
  total: number;
  previous: StepId | undefined;
  next: StepId | undefined;
}

/**
 * Where `current` sits in `steps`, with its neighbours.
 *
 * A `current` that is not in `steps` resolves to the first step rather than
 * throwing: that happens for real when answering `remote` on the topology
 * step while standing on `folder` — the step the user is on stops existing.
 * Callers treat the returned `id` as authoritative for that reason.
 */
export function positionOf(steps: StepId[], current: StepId): StepPosition {
  const index = steps.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  const id = steps[safeIndex] ?? 'console';
  return {
    id,
    number: safeIndex + 1,
    total: steps.length,
    previous: safeIndex > 0 ? steps[safeIndex - 1] : undefined,
    next: safeIndex < steps.length - 1 ? steps[safeIndex + 1] : undefined,
  };
}
