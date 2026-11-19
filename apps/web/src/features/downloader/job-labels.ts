import type { JobSummary } from './game-status.js';
import type { JobStatus } from './job-state.js';
import { plural } from '@/lib/plural.js';

/**
 * The job's status line. Counted in games, like the summary line and the
 * rows below. These three used to disagree: the header counted files, so
 * two two-disc games read as "0 / 4 téléchargés" above "2 en cours" above
 * two rows.
 */
export function statusLabel(status: JobStatus, summary: JobSummary): string {
  switch (status) {
    case 'running':
      return `${summary.done} / ${summary.total} ${plural(summary.total, 'jeu', 'jeux')} ${plural(summary.total, 'téléchargé')}`;
    case 'done': {
      const succeeded = `Terminé — ${summary.done} ${plural(summary.done, 'réussi')}`;
      if (summary.failed === 0) return succeeded;
      return `${succeeded}, ${summary.failed} ${plural(summary.failed, 'échoué')}`;
    }
    case 'cancelled':
      return 'Annulé';
    case 'error':
      return 'Erreur';
  }
}

/** "1 terminé · 2 en cours · 0 en attente", plus failures only when there are any. */
export function progressLine(summary: JobSummary): string {
  const parts = [
    `${summary.done} ${plural(summary.done, 'terminé')}`,
    `${summary.running} en cours`,
    `${summary.queued} en attente`,
  ];
  if (summary.failed > 0) parts.push(`${summary.failed} en échec`);
  return parts.join(' · ');
}
