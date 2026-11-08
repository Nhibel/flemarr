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

  const removeMutation = useMutation({
    mutationFn: (identifier: string) => deleteSource(identifier),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['archive-sources', system] }),
  });

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
    setSuggestions((prev) => prev?.filter((x) => x.identifier !== s.identifier) ?? null);
    void queryClient.invalidateQueries({ queryKey: ['archive-sources', system] });
  };

  const sources = data?.sources ?? [];

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
                <SuggestionRow key={s.identifier} suggestion={s} onAdopt={() => handleAdopt(s)} />
              ))}
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <AddSourceForm
          system={system}
          source={source}
          onDone={() => {
            setShowAdd(false);
            void queryClient.invalidateQueries({ queryKey: ['archive-sources', system] });
          }}
        />
      )}

      {sources.length === 0 && !showAdd ? (
        <p className={css({ fontSize: 'sm', color: 'fg.faint' })}>
          Aucune source configurée. Ajoutez un identifiant archive.org pour commencer.
        </p>
      ) : (
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
          {sources.map((s) => (
            <SourceRow
              key={s.identifier}
              source={s}
              onRemove={() => removeMutation.mutate(s.identifier)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
