import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { Button } from '@/components/Button.js';
import { SuggestionRow } from '@/features/archive/SuggestionRow.js';
import { suggestSources, addSource, fetchSources } from '@/lib/api.js';
import type { SuggestResponse } from '@/lib/api.js';

/**
 * The install flow's last step: where to fetch games from.
 *
 * The search runs on a button, never on arrival. The comps start it
 * automatically, but it probes a dozen archive.org collections and Camille
 * asked for network work to stay something she triggers. The step is also
 * skippable — sources can be added later from the Sources tab, and nothing
 * here blocks opening the library.
 */
export function SourcesStep({ datId, system }: { datId: string; system: string }) {
  const queryClient = useQueryClient();
  const [suggestions, setSuggestions] = useState<SuggestResponse['suggestions'] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['archive-sources', system],
    queryFn: () => fetchSources(system),
  });
  // Suggestions are re-validated on every run and never filtered
  // server-side, so an already-configured collection comes back listed.
  const configured = new Set((data?.sources ?? []).map((s) => s.identifier));

  const handleSearch = async () => {
    setSearching(true);
    setError(null);
    try {
      setSuggestions((await suggestSources(datId)).suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La recherche a échoué');
    } finally {
      setSearching(false);
    }
  };

  const handleAdopt = async (s: SuggestResponse['suggestions'][number]) => {
    await addSource(system, { identifier: s.identifier, layout: s.layout, note: s.title });
    await queryClient.invalidateQueries({ queryKey: ['archive-sources', system] });
  };

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '4' })}>
      <p className={css({ fontSize: 'sm', color: 'fg.muted', lineHeight: '1.6' })}>
        rom-curator télécharge les jeux depuis des collections archive.org. La recherche sonde
        chaque collection candidate contre un échantillon de ta liste et te dit quelle part elle
        contient réellement — et quelle part est prouvée par empreinte plutôt que devinée par nom.
      </p>

      <div className={css({ display: 'flex', alignItems: 'center', gap: '3', flexWrap: 'wrap' })}>
        <Button variant="primary" onClick={() => void handleSearch()} disabled={searching}>
          {searching ? 'Recherche en cours…' : 'Chercher des sources'}
        </Button>
        {configured.size > 0 && (
          <span className={css({ fontSize: 'xs', color: 'fg.subtle', fontFamily: 'mono' })}>
            {configured.size} source{configured.size > 1 ? 's' : ''} déjà configurée
            {configured.size > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {error !== null && (
        <p role="alert" className={css({ fontSize: 'sm', color: 'status.danger.text' })}>
          {error}
        </p>
      )}

      {suggestions !== null && suggestions.length === 0 && (
        <p className={css({ fontSize: 'sm', color: 'fg.subtle' })}>
          Aucune collection candidate trouvée sur archive.org pour ce système. Tu pourras en ajouter
          une à la main depuis l&apos;onglet Sources.
        </p>
      )}

      {suggestions !== null && suggestions.length > 0 && (
        <div
          className={css({
            bg: 'bg.surface',
            borderRadius: '16px',
            shadow: 'md',
            overflow: 'hidden',
          })}
        >
          {suggestions.map((s) => (
            <SuggestionRow
              key={s.identifier}
              suggestion={s}
              onAdopt={() => handleAdopt(s)}
              configured={configured.has(s.identifier)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
