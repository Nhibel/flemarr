import { describe, expect, it } from 'vitest';
import { progressLine, statusLabel } from './job-labels.js';
import type { JobSummary } from './game-status.js';

function summary(over: Partial<JobSummary> = {}): JobSummary {
  return { total: 0, done: 0, running: 0, queued: 0, failed: 0, ...over };
}

describe('statusLabel', () => {
  it('counts games while running, with the plural', () => {
    expect(statusLabel('running', summary({ total: 2, done: 1 }))).toBe('1 / 2 jeux téléchargés');
  });

  it('uses the singular for a single game', () => {
    expect(statusLabel('running', summary({ total: 1 }))).toBe('0 / 1 jeu téléchargé');
  });

  it('mentions failures only when there are some', () => {
    expect(statusLabel('done', summary({ done: 3 }))).toBe('Terminé — 3 réussis');
    expect(statusLabel('done', summary({ done: 1, failed: 2 }))).toBe(
      'Terminé — 1 réussi, 2 échoués',
    );
  });

  it('names the end states', () => {
    expect(statusLabel('cancelled', summary())).toBe('Annulé');
    expect(statusLabel('error', summary())).toBe('Erreur');
  });
});

describe('progressLine', () => {
  it('lists done, running and queued', () => {
    expect(progressLine(summary({ done: 2, running: 1, queued: 3 }))).toBe(
      '2 terminés · 1 en cours · 3 en attente',
    );
  });

  it('adds failures only when there are some', () => {
    expect(progressLine(summary({ done: 1, failed: 1 }))).toBe(
      '1 terminé · 0 en cours · 0 en attente · 1 en échec',
    );
  });
});
