import { plural } from '@/lib/plural.js';

/** The line under the source list: what the next resolve will search. */
export function searchScopeLabel(pickedCount: number, sourceCount: number): string {
  if (pickedCount === 0) {
    return 'La recherche portera sur toutes les sources. Coche-en pour la limiter.';
  }
  return `La recherche portera sur ${pickedCount} ${plural(pickedCount, 'source')} sur ${sourceCount}.`;
}
