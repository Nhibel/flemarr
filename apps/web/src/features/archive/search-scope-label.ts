import { plural } from '@/lib/plural.js';

/** The line under the source list: what the next resolve will search. */
export function searchScopeLabel(activeCount: number, sourceCount: number): string {
  if (activeCount === sourceCount) return 'La recherche portera sur toutes les sources.';
  if (activeCount === 0) return 'Aucune source active : la recherche est impossible.';
  return `La recherche portera sur ${activeCount} ${plural(activeCount, 'source')} sur ${sourceCount}.`;
}
