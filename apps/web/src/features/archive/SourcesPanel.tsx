import { useState, useCallback } from 'react';
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
} from '@/lib/api.js';
import type { ArchiveSource, ArchiveLayout, ResolveResponse } from '@/lib/api.js';
import type { QueuedDownload } from '@/features/downloader/DownloadManager.js';

interface Props {
  datId: string;
  system: string;
  selectedGameIds: string[];
  onQueueDownload: (job: QueuedDownload) => void;
}

export function SourcesPanel({ datId, system, selectedGameIds, onQueueDownload }: Props) {
  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '8' })}>
      <SourcesManager system={system} />
      <ResolvePanel
        datId={datId}
        system={system}
        selectedGameIds={selectedGameIds}
        onQueueDownload={onQueueDownload}
      />
    </div>
  );
}

// ── Sources manager ────────────────────────────────────────────────────────────

function SourcesManager({ system }: { system: string }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data } = useQuery({
    queryKey: ['archive-sources', system],
    queryFn: () => fetchSources(system),
  });

  const removeMutation = useMutation({
    mutationFn: (identifier: string) => deleteSource(identifier),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['archive-sources', system] }),
  });

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

      {showAdd && (
        <AddSourceForm
          system={system}
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
              system={system}
              onRemove={() => removeMutation.mutate(s.identifier)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SourceRow({
  source,
  system,
  onRemove,
}: {
  source: ArchiveSource;
  system: string;
  onRemove: () => void;
}) {
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

function AddSourceForm({ system, onDone }: { system: string; onDone: () => void }) {
  const [identifier, setIdentifier] = useState('');
  const [layout, setLayout] = useState<ArchiveLayout>('direct');
  const [note, setNote] = useState('');
  const [searchQ, setSearchQ] = useState('');
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
      await addSource(system, { identifier: identifier.trim(), layout, note });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
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
            onChange={(e) => setLayout(e.target.value as ArchiveLayout)}
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
  onQueueDownload,
}: {
  datId: string;
  system: string;
  selectedGameIds: string[];
  onQueueDownload: (job: QueuedDownload) => void;
}) {
  const [result, setResult] = useState<ResolveResponse | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destinationDir, setDestinationDir] = useState('');
  const [queuing, setQueuing] = useState(false);

  const { data: sourcesData } = useQuery({
    queryKey: ['archive-sources', system],
    queryFn: () => fetchSources(system),
  });

  const hasSources = (sourcesData?.sources.length ?? 0) > 0;

  const handleResolve = useCallback(async () => {
    if (selectedGameIds.length === 0) return;
    setResolving(true);
    setError(null);
    try {
      const res = await resolveGames(datId, selectedGameIds);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setResolving(false);
    }
  }, [datId, selectedGameIds]);

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
      const jobId = await startDownload({ items, destinationDir: destinationDir.trim() });
      onQueueDownload({ jobId, items, destinationDir: destinationDir.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur au lancement');
    } finally {
      setQueuing(false);
    }
  }, [result, destinationDir, onQueueDownload]);

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
          disabled={resolving || selectedGameIds.length === 0 || !hasSources}
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
            : `Chercher les sources (${selectedGameIds.length} jeu${selectedGameIds.length !== 1 ? 'x' : ''})`}
        </button>
      </div>

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
                onChange={(e) => setDestinationDir(e.target.value)}
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
  return (
    <div
      className={css({
        p: '3',
        border: '1px solid',
        borderRadius: 'md',
        borderColor: found ? 'green.200' : 'bd.default',
        bg: found ? 'green.50' : 'bg.page',
      })}
    >
      <div className={css({ display: 'flex', alignItems: 'flex-start', gap: '2' })}>
        <span
          className={css({ fontSize: 'sm', color: found ? 'green.700' : 'fg.faint', mt: '0.5' })}
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
