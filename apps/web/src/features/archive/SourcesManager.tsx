import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { fetchSources, addSource, deleteSource, suggestSources } from '@/lib/api.js';
import type { SuggestResponse } from '@/lib/api.js';
import type { DatSource } from './SourcesPanel.js';
import { SuggestionRow } from './SuggestionRow.js';
import { SourceRow } from './SourceRow.js';
import { AddSourceForm } from './AddSourceForm.js';
import { Button } from '@/components/Button.js';

export function SourcesManager({
  datId,
  system,
  source,
}: {
  datId: string;
  system: string;
  source: DatSource;
}) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestResponse['suggestions'] | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['archive-sources', system],
    queryFn: () => fetchSources(system),
  });

  // One shared mutation, but the row it is acting on is identified by
  // `variables`, so only that row shows a pending state or an error — a
  // failed delete used to disappear entirely (no onError, no feedback).
  const removeMutation = useMutation({
    mutationFn: (identifier: string) => deleteSource(identifier, system),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['archive-sources', system] }),
  });

  const removeErrorFor = (identifier: string): string | null =>
    removeMutation.variables === identifier && removeMutation.error instanceof Error
      ? removeMutation.error.message
      : null;

  const handleSuggest = async () => {
    setSuggesting(true);
    setSuggestError(null);
    try {
      const res = await suggestSources(datId);
      setSuggestions(res.suggestions);
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSuggesting(false);
    }
  };

  const handleAdopt = async (s: SuggestResponse['suggestions'][number]) => {
    await addSource(system, { identifier: s.identifier, layout: s.layout, note: s.title });
    await queryClient.invalidateQueries({ queryKey: ['archive-sources', system] });
  };

  const sources = data?.sources ?? [];
  // Suggestions are re-validated on every run and never filtered server-side,
  // so an already-configured collection comes back listed. Marking it from the
  // live source list covers both that and a just-adopted one, without dropping
  // rows — dropping them is what made the panel claim nothing had been found
  // once the last suggestion was taken.
  const configured = new Set(sources.map((src) => src.identifier));

  return (
    <section>
      <div className={css({ display: 'flex', alignItems: 'center', gap: '3', mb: '3' })}>
        <h2
          className={css({
            fontSize: 'base',
            fontWeight: 'semibold',
            color: 'fg.heading',
            flex: 1,
          })}
        >
          Sources pour {system}
        </h2>
        <button
          onClick={() => void handleSuggest()}
          disabled={suggesting}
          className={css({
            px: '3',
            py: '1.5',
            fontSize: 'sm',
            fontWeight: 'medium',
            borderRadius: 'lg',
            bg: 'accent2.solid',
            color: 'accent2.fg',
            cursor: 'pointer',
            transition: 'background-color 0.15s',
            _hover: { bg: 'accent2.hover' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          {suggesting ? 'Analyse…' : '✨ Suggérer des sources'}
        </button>
        <Button variant="secondary" size="sm" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? 'Annuler' : '+ Ajouter'}
        </Button>
      </div>

      {suggestError && (
        <p role="alert" className={css({ fontSize: 'sm', color: 'status.danger.text', mb: '3' })}>
          {suggestError}
        </p>
      )}

      {suggestions !== null && (
        <div className={css({ mb: '4' })}>
          {suggestions.length === 0 ? (
            <p className={css({ fontSize: 'sm', color: 'fg.faint' })}>
              Aucune collection candidate trouvée sur archive.org pour ce système.
            </p>
          ) : (
            <div
              className={css({
                border: '1px solid',
                borderColor: 'accent2.subtleBorder',
                borderRadius: 'xl',
                shadow: 'sm',
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
      )}

      {showAdd && (
        <AddSourceForm
          system={system}
          source={source}
          configured={configured}
          onDone={() => {
            setShowAdd(false);
            void queryClient.invalidateQueries({ queryKey: ['archive-sources', system] });
          }}
          onAdded={() => void queryClient.invalidateQueries({ queryKey: ['archive-sources', system] })}
        />
      )}

      {sources.length === 0 && !showAdd ? (
        <p className={css({ fontSize: 'sm', color: 'fg.faint' })}>
          Aucune source configurée. Ajoutez une collection archive.org pour commencer.
        </p>
      ) : (
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
          {sources.map((s) => (
            <SourceRow
              key={s.identifier}
              source={s}
              onRemove={() => removeMutation.mutate(s.identifier)}
              removing={removeMutation.isPending && removeMutation.variables === s.identifier}
              removeError={removeErrorFor(s.identifier)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
