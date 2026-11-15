import { describe, it, expect } from 'vitest';
import { stepsFor, positionOf, STEP_LABELS } from './install-steps.js';
import type { StepId } from './install-steps.js';

describe('stepsFor', () => {
  it('is four steps when the server can reach the collection', () => {
    for (const topology of ['local', 'mounted'] as const) {
      expect(stepsFor(topology)).toEqual(['topology', 'console', 'folder', 'sources']);
    }
  });

  // The server cannot read the collection in remote mode, so asking for a
  // folder would be asking for something it can do nothing with.
  it('drops the folder step in remote mode', () => {
    expect(stepsFor('remote')).toEqual(['topology', 'console', 'sources']);
  });

  // The first run shows the question before it can know the answer. Assuming
  // the longest sequence means the count only ever shrinks, never grows
  // under the user mid-flow.
  it('assumes the full sequence before the question is answered', () => {
    expect(stepsFor(undefined)).toEqual(['topology', 'console', 'folder', 'sources']);
  });

  it('can start at the console, for adding a console later', () => {
    expect(stepsFor('local', { skipTopology: true })).toEqual(['console', 'folder', 'sources']);
    expect(stepsFor('remote', { skipTopology: true })).toEqual(['console', 'sources']);
  });
});

describe('positionOf', () => {
  it('numbers over the steps that exist, never leaving a hole', () => {
    const steps = stepsFor('remote');
    expect(positionOf(steps, 'sources')).toMatchObject({ number: 3, total: 3 });
    // The same step is 4 of 4 when the folder step is in play — the number
    // follows the real sequence rather than a fixed position.
    expect(positionOf(stepsFor('local'), 'sources')).toMatchObject({ number: 4, total: 4 });
  });

  it('goes back to the console from the sources when there is no folder step', () => {
    expect(positionOf(stepsFor('remote'), 'sources').previous).toBe('console');
    expect(positionOf(stepsFor('local'), 'sources').previous).toBe('folder');
  });

  it('has no previous on the first step and no next on the last', () => {
    const steps = stepsFor('local');
    expect(positionOf(steps, 'topology').previous).toBeUndefined();
    expect(positionOf(steps, 'sources').next).toBeUndefined();
  });

  // Answering `remote` while standing on the folder step removes the step
  // the user is on. Resolving to the first step rather than throwing is what
  // keeps that from crashing the flow.
  it('falls back to the first step when the current one stopped existing', () => {
    const pos = positionOf(stepsFor('remote'), 'folder');
    expect(pos.id).toBe('topology');
    expect(pos.number).toBe(1);
  });

  it('every step has a label', () => {
    const all: StepId[] = ['topology', 'console', 'folder', 'sources'];
    for (const id of all) expect(STEP_LABELS[id]).toBeTruthy();
  });
});
