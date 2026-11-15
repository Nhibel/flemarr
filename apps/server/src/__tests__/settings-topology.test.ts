import { describe, it, expect, beforeEach } from 'vitest';
import type { Database } from 'better-sqlite3';
import { createDb } from '../lib/db.js';
import { getSettings, updateSettings } from '../services/settings/index.js';

// The topology answer is the only setting with three states rather than
// two: each of the three answers, plus "never asked". That last one is what
// gates the install flow, so it has to survive a round trip as null rather
// than collapsing into a default — and it has to be resettable.

let db: Database;

beforeEach(() => {
  db = createDb(':memory:');
});

describe('topology setting', () => {
  it('reads back as null when it was never answered', () => {
    expect(getSettings(db).topology).toBeNull();
  });

  it('round-trips each answer', () => {
    for (const answer of ['local', 'mounted', 'remote'] as const) {
      updateSettings({ topology: answer }, db);
      expect(getSettings(db).topology).toBe(answer);
    }
  });

  // An absent key in a patch means "leave it alone", but null is a real
  // value here, so it cannot be written the same way as the others — it
  // has to remove the row. Without this, the install question could be
  // answered but never un-answered.
  it('writing null clears the answer instead of being ignored', () => {
    updateSettings({ topology: 'mounted' }, db);
    expect(getSettings(db).topology).toBe('mounted');

    updateSettings({ topology: null }, db);
    expect(getSettings(db).topology).toBeNull();
  });

  it('a patch that omits it leaves the recorded answer alone', () => {
    updateSettings({ topology: 'remote' }, db);
    updateSettings({ downloaderConcurrency: 4 }, db);

    const after = getSettings(db);
    expect(after.topology).toBe('remote');
    expect(after.downloaderConcurrency).toBe(4);
  });
});
