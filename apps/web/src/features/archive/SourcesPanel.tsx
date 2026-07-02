import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import {
  fetchSources,
  addSource,
  deleteSource,
  searchArchive,
  previewIndex,
  resolveGames,
  startDownload,
  getSettings,
  suggestSources,
} from '@/lib/api.js';
import type { ArchiveSource, ArchiveLayout, ResolveResponse, SuggestResponse } from '@/lib/api.js';
import type { QueuedDownload } from '@/features/downloader/DownloadManager.js';

type DatSource = 'no-intro' | 'redump';

interface Props {
  datId: string;
  system: string;
  source: DatSource;
  selectedGameIds: string[];
  /** Selected games absent from the last scan — null when no scan ran yet */
  missingGameIds: string[] | null;
  onQueueDownload: (job: QueuedDownload) => void;
}

export function SourcesPanel({
  datId,
  system,
  source,
  selectedGameIds,
  missingGameIds,
  onQueueDownload,
}: Props) {
  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '8' })}>
      <SourcesManager datId={datId} system={system} source={source} />
      <ResolvePanel
        datId={datId}
        system={system}
        selectedGameIds={selectedGameIds}
        missingGameIds={missingGameIds}
        onQueueDownload={onQueueDownload}
      />
    </div>
  );
}

// "Nintendo - Super Nintendo Entertainment System" → "Super Nintendo Entertainment System"
function shortSystemName(system: string): string {
  return system.replace(/^[^-]+-\s*/, '').trim() || system;
}

export function defaultSearchQuery(system: string, source: DatSource): string {
  return `${source === 'redump' ? 'Redump' : 'No-Intro'} ${shortSystemName(system)}`;
}

// ── Sources manager ────────────────────────────────────────────────────────────

function SourcesManager({
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
            bg: 'violet.500',
            color: 'white',
            borderRadius: 'md',
            cursor: 'pointer',
            _hover: { bg: 'violet.600' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          {suggesting ? 'Analyse…' : '✨ Suggérer des sources'}
        </button>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className={css({
            px: '3',
            py: '1.5',
            fontSize: 'sm',
            fontWeight: 'medium',
            bg: 'blue.500',
            color: 'white',
            borderRadius: 'md',
            cursor: 'pointer',
            _hover: { bg: 'blue.600' },
          })}
        >
          {showAdd ? 'Annuler' : '+ Ajouter'}
        </button>
      </div>

      {suggestError && (
        <p role="alert" className={css({ fontSize: 'sm', color: 'red.600', mb: '3' })}>
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
                borderColor: 'violet.200',
                borderRadius: 'md',
                overflow: 'hidden',
                _dark: { borderColor: 'violet.800' },
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

function SuggestionRow({
  suggestion,
  onAdopt,
}: {
  suggestion: SuggestResponse['suggestions'][number];
  onAdopt: () => Promise<void>;
}) {
  const [adopting, setAdopting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pct = Math.round(suggestion.coverage * 100);
  const pctColor = pct >= 80 ? 'green.600' : pct >= 40 ? 'amber.600' : 'red.600';

  const handleAdopt = async () => {
    setAdopting(true);
    setError(null);
    try {
      await onAdopt();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setAdopting(false);
    }
  };

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '3',
        px: '3',
        py: '2.5',
        borderBottom: '1px solid',
        borderColor: 'bd.subtle',
        bg: 'bg.page',
        _last: { borderBottom: 'none' },
      })}
    >
      <div className={css({ flex: 1, minW: 0 })}>
        <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
          <span
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'fg.heading',
              fontFamily: 'mono',
              truncate: true,
            })}
          >
            {suggestion.identifier}
          </span>
          <LayoutBadge layout={suggestion.layout} />
        </div>
        <p className={css({ fontSize: 'xs', color: 'fg.faint' })}>
          <span className={css({ fontWeight: 'semibold', color: pctColor })}>
            {pct} % de couverture
          </span>{' '}
          (échantillon de {suggestion.sampleSize}) · {suggestion.fileCount} fichiers
        </p>
        {error && <p className={css({ fontSize: 'xs', color: 'red.600', mt: '1' })}>{error}</p>}
      </div>
      <button
        onClick={() => void handleAdopt()}
        disabled={adopting}
        className={css({
          px: '3',
          py: '1',
          fontSize: 'xs',
          fontWeight: 'medium',
          borderRadius: 'md',
          cursor: 'pointer',
          bg: 'violet.500',
          color: 'white',
          flexShrink: 0,
          _hover: { bg: 'violet.600' },
          _disabled: { opacity: 0.5, cursor: 'not-allowed' },
        })}
      >
        {adopting ? '…' : 'Adopter'}
      </button>
    </div>
  );
}

function SourceRow({ source, onRemove }: { source: ArchiveSource; onRemove: () => void }) {
  const [preview, setPreview] = useState<{ fileCount: number } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestError(null);
    try {
      const result = await previewIndex(source.identifier);
      setPreview({ fileCount: result.fileCount });
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'flex-start',
        gap: '3',
        p: '3',
        border: '1px solid',
        borderColor: 'bd.default',
        borderRadius: 'md',
        bg: 'bg.page',
      })}
    >
      <div className={css({ flex: 1, minW: 0 })}>
        <div className={css({ display: 'flex', alignItems: 'center', gap: '2', mb: '0.5' })}>
          <span
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'fg.heading',
              fontFamily: 'mono',
            })}
          >
            {source.identifier}
          </span>
          <LayoutBadge layout={source.layout} />
        </div>
        {source.note && <p className={css({ fontSize: 'xs', color: 'fg.faint' })}>{source.note}</p>}
        {preview && (
          <p className={css({ fontSize: 'xs', color: 'green.600', mt: '1' })}>
            ✓ {preview.fileCount} fichiers trouvés
          </p>
        )}
        {testError && (
          <p className={css({ fontSize: 'xs', color: 'red.600', mt: '1' })}>{testError}</p>
        )}
      </div>
      <div className={css({ display: 'flex', gap: '2', flexShrink: 0 })}>
        <button
          onClick={() => void handleTest()}
          disabled={testing}
          className={css({
            px: '2.5',
            py: '1',
            fontSize: 'xs',
            borderRadius: 'md',
            cursor: 'pointer',
            border: '1px solid',
            borderColor: 'bd.strong',
            color: 'fg.muted',
            _hover: { bg: 'bg.surface' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          {testing ? '…' : 'Tester'}
        </button>
        <button
          onClick={onRemove}
          className={css({
            px: '2.5',
            py: '1',
            fontSize: 'xs',
            borderRadius: 'md',
            cursor: 'pointer',
            border: '1px solid',
            borderColor: 'red.200',
            color: 'red.600',
            _hover: { bg: 'red.50' },
          })}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

function LayoutBadge({ layout }: { layout: ArchiveLayout }) {
  return (
    <span
      className={css({
        px: '1.5',
        py: '0.5',
        fontSize: 'xs',
        borderRadius: 'sm',
        bg: layout === 'direct' ? 'green.50' : 'blue.50',
        color: layout === 'direct' ? 'green.700' : 'blue.700',
        border: '1px solid',
        borderColor: layout === 'direct' ? 'green.200' : 'blue.200',
      })}
    >
      {layout === 'direct' ? 'direct' : 'zip'}
    </span>
  );
}

// ── Add source form ────────────────────────────────────────────────────────────

type LayoutChoice = ArchiveLayout | 'auto';

function AddSourceForm({
  system,
  source,
  onDone,
}: {
  system: string;
  source: DatSource;
  onDone: () => void;
}) {
  const [identifier, setIdentifier] = useState('');
  const [layout, setLayout] = useState<LayoutChoice>('auto');
  const [note, setNote] = useState('');
  const [searchQ, setSearchQ] = useState(() => defaultSearchQuery(system, source));
  const [searchResults, setSearchResults] = useState<
    { identifier: string; title: string; description: string }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const res = await searchArchive(searchQ.trim());
      setSearchResults(res.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recherche échouée');
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async () => {
    if (!identifier.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let resolvedLayout: ArchiveLayout;
      if (layout === 'auto') {
        // The index fetch tells us how the collection stores its ROMs
        const idx = await previewIndex(identifier.trim());
        resolvedLayout = idx.suggestedLayout;
      } else {
        resolvedLayout = layout;
      }
      await addSource(system, { identifier: identifier.trim(), layout: resolvedLayout, note });
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur';
      setError(
        layout === 'auto'
          ? `${message} — impossible de détecter le layout, choisissez-le manuellement`
          : message,
      );
      setSaving(false);
    }
  };

  return (
    <div
      className={css({
        mb: '4',
        p: '4',
        border: '1px solid',
        borderColor: 'blue.200',
        borderRadius: 'md',
        bg: 'blue.50',
        display: 'flex',
        flexDirection: 'column',
        gap: '3',
      })}
    >
      {/* Search */}
      <div>
        <p className={css({ fontSize: 'xs', color: 'fg.subtle', mb: '1.5' })}>
          Rechercher sur archive.org (optionnel)
        </p>
        <div className={css({ display: 'flex', gap: '2' })}>
          <input
            type="text"
            placeholder={`ex. "No-Intro SNES" ou "Redump PS2"`}
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSearch();
            }}
            className={css({
              flex: 1,
              px: '2.5',
              py: '1.5',
              fontSize: 'sm',
              border: '1px solid',
              borderColor: 'bd.strong',
              borderRadius: 'md',
              bg: 'bg.page',
              outline: 'none',
              _focusVisible: { borderColor: 'blue.400' },
            })}
          />
          <button
            onClick={() => void handleSearch()}
            disabled={searching || !searchQ.trim()}
            className={css({
              px: '3',
              py: '1.5',
              fontSize: 'sm',
              bg: 'bg.page',
              border: '1px solid',
              borderColor: 'bd.strong',
              borderRadius: 'md',
              cursor: 'pointer',
              _hover: { bg: 'bg.surface' },
              _disabled: { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            {searching ? '…' : 'Chercher'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div
            className={css({
              mt: '2',
              border: '1px solid',
              borderColor: 'bd.default',
              borderRadius: 'md',
              bg: 'bg.page',
              maxH: '48',
              overflowY: 'auto',
            })}
          >
            {searchResults.map((r) => (
              <button
                key={r.identifier}
                onClick={() => {
                  setIdentifier(r.identifier);
                  setNote(r.title);
                  setSearchResults([]);
                }}
                className={css({
                  display: 'block',
                  w: 'full',
                  textAlign: 'left',
                  px: '3',
                  py: '2',
                  fontSize: 'sm',
                  borderBottom: '1px solid',
                  borderColor: 'gray.100',
                  cursor: 'pointer',
                  _hover: { bg: 'blue.50' },
                  _last: { borderBottom: 'none' },
                })}
              >
                <span className={css({ fontFamily: 'mono', color: 'blue.700', display: 'block' })}>
                  {r.identifier}
                </span>
                {r.title !== r.identifier && (
                  <span className={css({ color: 'fg.subtle', fontSize: 'xs' })}>{r.title}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Manual fields */}
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
        <div className={css({ display: 'flex', gap: '2' })}>
          <input
            type="text"
            placeholder="Identifiant archive.org"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={css({
              flex: 1,
              px: '2.5',
              py: '1.5',
              fontSize: 'sm',
              border: '1px solid',
              borderColor: 'bd.strong',
              borderRadius: 'md',
              bg: 'bg.page',
              outline: 'none',
              fontFamily: 'mono',
              _focusVisible: { borderColor: 'blue.400' },
            })}
          />
          <select
            value={layout}
            onChange={(e) => setLayout(e.target.value as LayoutChoice)}
            className={css({
              px: '2.5',
              py: '1.5',
              fontSize: 'sm',
              border: '1px solid',
              borderColor: 'bd.strong',
              borderRadius: 'md',
              bg: 'bg.page',
              cursor: 'pointer',
            })}
          >
            <option value="auto">layout auto</option>
            <option value="direct">direct</option>
            <option value="zip-collection">zip-collection</option>
          </select>
        </div>
        <input
          type="text"
          placeholder="Note (optionnelle)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={css({
            px: '2.5',
            py: '1.5',
            fontSize: 'sm',
            border: '1px solid',
            borderColor: 'bd.strong',
            borderRadius: 'md',
            bg: 'bg.page',
            outline: 'none',
            _focusVisible: { borderColor: 'blue.400' },
          })}
        />
      </div>

      {error && (
        <p role="alert" className={css({ fontSize: 'xs', color: 'red.600' })}>
          {error}
        </p>
      )}

      <button
        onClick={() => void handleSave()}
        disabled={saving || !identifier.trim()}
        className={css({
          alignSelf: 'flex-start',
          px: '4',
          py: '1.5',
          fontSize: 'sm',
          fontWeight: 'medium',
          bg: 'blue.500',
          color: 'white',
          borderRadius: 'md',
          cursor: 'pointer',
          _hover: { bg: 'blue.600' },
          _disabled: { opacity: 0.5, cursor: 'not-allowed' },
        })}
      >
        {saving ? 'Ajout…' : 'Ajouter la source'}
      </button>
    </div>
  );
}

// ── Resolve panel ─────────────────────────────────────────────────────────────

function ResolvePanel({
  datId,
  system,
  selectedGameIds,
  missingGameIds,
  onQueueDownload,
}: {
  datId: string;
  system: string;
  selectedGameIds: string[];
  missingGameIds: string[] | null;
  onQueueDownload: (job: QueuedDownload) => void;
}) {
  const [result, setResult] = useState<ResolveResponse | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destinationDir, setDestinationDir] = useState('');
  const [destTouched, setDestTouched] = useState(false);
  const [excludeOwned, setExcludeOwned] = useState(true);
  const [queuing, setQueuing] = useState(false);

  const { data: sourcesData } = useQuery({
    queryKey: ['archive-sources', system],
    queryFn: () => fetchSources(system),
  });

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings });

  // Downloads are confined to settings.systemPaths — prefill with the path
  // configured for this system (or the only one configured) instead of
  // letting the user type something the server will reject.
  const paths = settings?.systemPaths ?? {};
  const defaultDest =
    paths[system] ?? (Object.values(paths).length === 1 ? Object.values(paths)[0] : undefined);
  useEffect(() => {
    if (defaultDest !== undefined && !destTouched) setDestinationDir(defaultDest);
  }, [defaultDest, destTouched]);

  const hasSources = (sourcesData?.sources.length ?? 0) > 0;
  const noPathsConfigured = settings !== undefined && Object.keys(paths).length === 0;

  const effectiveGameIds =
    excludeOwned && missingGameIds !== null ? missingGameIds : selectedGameIds;

  const handleResolve = useCallback(async () => {
    if (effectiveGameIds.length === 0) return;
    setResolving(true);
    setError(null);
    try {
      const res = await resolveGames(datId, effectiveGameIds);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setResolving(false);
    }
  }, [datId, effectiveGameIds]);

  const handleDownload = useCallback(async () => {
    if (!result || !destinationDir.trim()) return;
    const found = result.results.filter((r) => r.sources.length > 0);
    if (found.length === 0) return;
    setQueuing(true);
    try {
      const items = found.map((r) => ({
        gameId: r.gameId,
        romName: r.romName,
        expectedCrc: r.expectedCrc,
        downloadUrl: r.sources[0]!.downloadUrl,
      }));
      const jobId = await startDownload({ datId, items, destinationDir: destinationDir.trim() });
      onQueueDownload({ jobId, items, destinationDir: destinationDir.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur au lancement');
    } finally {
      setQueuing(false);
    }
  }, [result, datId, destinationDir, onQueueDownload]);

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
          Résolution des sources
        </h2>
        <button
          onClick={() => void handleResolve()}
          disabled={resolving || effectiveGameIds.length === 0 || !hasSources}
          className={css({
            px: '3',
            py: '1.5',
            fontSize: 'sm',
            fontWeight: 'medium',
            bg: 'green.500',
            color: 'white',
            borderRadius: 'md',
            cursor: 'pointer',
            _hover: { bg: 'green.600' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          {resolving
            ? 'Recherche…'
            : `Chercher les sources (${effectiveGameIds.length} jeu${effectiveGameIds.length !== 1 ? 'x' : ''})`}
        </button>
      </div>

      {missingGameIds !== null && (
        <label
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            mb: '3',
            fontSize: 'sm',
            color: 'fg.default',
            cursor: 'pointer',
          })}
        >
          <input
            type="checkbox"
            checked={excludeOwned}
            onChange={(e) => setExcludeOwned(e.target.checked)}
          />
          Exclure les jeux déjà possédés d'après le dernier scan (
          {selectedGameIds.length - missingGameIds.length} sur {selectedGameIds.length} possédé
          {selectedGameIds.length - missingGameIds.length !== 1 ? 's' : ''})
        </label>
      )}

      {!hasSources && (
        <p className={css({ fontSize: 'sm', color: 'amber.600' })}>
          Ajoutez au moins une source ci-dessus avant de lancer la résolution.
        </p>
      )}

      {selectedGameIds.length === 0 && hasSources && (
        <p className={css({ fontSize: 'sm', color: 'fg.faint' })}>
          Sélectionnez des jeux dans l'onglet Games pour lancer la résolution.
        </p>
      )}

      {selectedGameIds.length > 0 && effectiveGameIds.length === 0 && hasSources && (
        <p className={css({ fontSize: 'sm', color: 'green.600' })}>
          Tous les jeux sélectionnés sont déjà présents sur le disque — rien à télécharger.
        </p>
      )}

      {noPathsConfigured && (
        <p className={css({ fontSize: 'sm', color: 'amber.600' })}>
          Aucun dossier système configuré : les téléchargements seront refusés. Ajoutez un dossier
          dans Paramètres.
        </p>
      )}

      {error && (
        <p role="alert" className={css({ fontSize: 'sm', color: 'red.600' })}>
          {error}
        </p>
      )}

      {result && (
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
          <div className={css({ display: 'flex', gap: '3' })}>
            <Chip
              label="Trouvés"
              count={result.results.filter((r) => r.sources.length > 0).length}
              color="green"
            />
            <Chip
              label="Non trouvés"
              count={result.results.filter((r) => r.sources.length === 0).length}
              color="gray"
            />
          </div>

          {result.results.filter((r) => r.sources.length > 0).length > 0 && (
            <div className={css({ display: 'flex', gap: '2', alignItems: 'center' })}>
              <input
                type="text"
                placeholder="Dossier de destination (ex. /mnt/roms/snes)"
                value={destinationDir}
                onChange={(e) => {
                  setDestTouched(true);
                  setDestinationDir(e.target.value);
                }}
                className={css({
                  flex: 1,
                  px: '2.5',
                  py: '1.5',
                  fontSize: 'sm',
                  border: '1px solid',
                  borderColor: 'bd.strong',
                  borderRadius: 'md',
                  bg: 'bg.page',
                  outline: 'none',
                  _focusVisible: { borderColor: 'blue.400' },
                })}
              />
              <button
                onClick={() => void handleDownload()}
                disabled={queuing || !destinationDir.trim()}
                className={css({
                  px: '3',
                  py: '1.5',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  flexShrink: 0,
                  bg: 'green.500',
                  color: 'white',
                  borderRadius: 'md',
                  cursor: 'pointer',
                  _hover: { bg: 'green.600' },
                  _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                })}
              >
                {queuing
                  ? 'Lancement…'
                  : `Télécharger (${result.results.filter((r) => r.sources.length > 0).length})`}
              </button>
            </div>
          )}

          <div className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
            {result.results.map((r) => (
              <ResolvedGameRow key={r.gameId} game={r} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ResolvedGameRow({ game }: { game: ResolveResponse['results'][number] }) {
  const found = game.sources.length > 0;
  const containerStyle = css.raw(
    found
      ? {
          borderColor: 'green.200',
          bg: 'green.50',
          _dark: { bg: 'green.900', borderColor: 'green.800' },
        }
      : { borderColor: 'bd.default', bg: 'bg.page' },
  );
  return (
    <div className={css({ p: '3', border: '1px solid', borderRadius: 'md' }, containerStyle)}>
      <div className={css({ display: 'flex', alignItems: 'flex-start', gap: '2' })}>
        <span
          className={css({
            fontSize: 'sm',
            color: found ? 'green.700' : 'fg.faint',
            _dark: found ? { color: 'green.400' } : undefined,
            mt: '0.5',
          })}
        >
          {found ? '✓' : '—'}
        </span>
        <div className={css({ flex: 1, minW: 0 })}>
          <p className={css({ fontSize: 'sm', color: 'fg.heading', fontWeight: 'medium' })}>
            {game.romName || game.gameId}
          </p>
          {found ? (
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '1', mt: '1' })}>
              {game.sources.map((s, i) => (
                <p
                  key={i}
                  className={css({
                    fontSize: 'xs',
                    color: 'fg.subtle',
                    fontFamily: 'mono',
                    truncate: true,
                  })}
                >
                  [{s.container}] {s.identifier}
                </p>
              ))}
            </div>
          ) : (
            <p className={css({ fontSize: 'xs', color: 'fg.faint', mt: '0.5' })}>
              Non trouvé dans les sources configurées
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ label, count, color }: { label: string; count: number; color: 'green' | 'gray' }) {
  const colorStyle = css.raw(
    color === 'green'
      ? { bg: 'green.50', borderColor: 'green.200', color: 'green.700' }
      : { bg: 'bg.surface', borderColor: 'bd.default', color: 'fg.muted' },
  );

  return (
    <span
      className={css(
        {
          px: '3',
          py: '1',
          borderRadius: 'full',
          fontSize: 'xs',
          fontWeight: 'medium',
          border: '1px solid',
        },
        colorStyle,
      )}
    >
      {count} {label}
    </span>
  );
}
