import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { listDatSources, fetchDatFromFresh1g1r, getSettings } from '@/lib/api.js';
import type { Fresh1g1rPreset, ListSourcesResponse } from '@/lib/api.js';
import type { DatUploadResponse } from '@shared/api.js';

const PRESETS: Fresh1g1rPreset[] = ['PropeR', 'McLean', 'Hearto'];

const PRESET_DESCRIPTIONS: Record<Fresh1g1rPreset, string> = {
  McLean: 'Anglais uniquement, jeux licenciés seulement. Sélection la plus stricte.',
  PropeR: 'Toutes langues · jeux, add-ons, bonus discs, éducatif. Officiel uniquement.',
  Hearto: 'Le plus large · toutes langues, démos, non-licenciés, proto/bêta/alpha.',
};

interface Props {
  onSuccess: (dat: DatUploadResponse) => void;
}

export function Fresh1g1rBrowser({ onSuccess }: Props) {
  const { data: settingsData } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const [preset, setPreset] = useState<Fresh1g1rPreset | null>(null);
  const resolvedPreset: Fresh1g1rPreset = preset ?? settingsData?.fresh1g1rPreset ?? 'PropeR';
  const [search, setSearch] = useState('');
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Loading no longer navigates away — this is the only in-screen feedback
  // that a given preset actually loaded, so it persists for the session.
  const [loadedPaths, setLoadedPaths] = useState<Set<string>>(new Set());

  const {
    data,
    isLoading,
    error: listError,
    refetch,
  } = useQuery({
    queryKey: ['dat-sources', resolvedPreset],
    queryFn: () => listDatSources(resolvedPreset),
    staleTime: 5 * 60 * 1000, // 5 min — GitHub contents don't change that fast
  });

  const loadMutation = useMutation({
    mutationFn: (entry: ListSourcesResponse['sources'][number]) =>
      fetchDatFromFresh1g1r({ preset: resolvedPreset, path: entry.path, sha: entry.sha }),
    onSuccess: (dat) => onSuccess(dat),
    onError: (err) => setLoadError(err instanceof Error ? err.message : 'Erreur'),
  });

  const sources = data?.sources ?? [];
  const filtered = search.trim()
    ? sources.filter((s) => s.system.toLowerCase().includes(search.toLowerCase()))
    : sources;

  const handleLoad = (entry: ListSourcesResponse['sources'][number]) => {
    setLoadError(null);
    setLoadingPath(entry.path);
    loadMutation.mutate(entry, {
      onSuccess: () => setLoadedPaths((prev) => new Set(prev).add(entry.path)),
      onSettled: () => setLoadingPath(null),
    });
  };

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
      <p className={css({ fontSize: 'xs', color: 'fg.faint' })}>
        Charger un système l'ajoute à « Reprendre un DAT chargé » ci-dessus — cliquez-y pour
        l'ouvrir. Vous pouvez en charger plusieurs à la suite.
      </p>

      {/* Preset + refresh */}
      <div className={css({ display: 'flex', gap: '2', alignItems: 'center' })}>
        <span className={css({ fontSize: 'sm', color: 'fg.muted', flexShrink: 0 })}>Preset</span>
        <div className={css({ display: 'flex', gap: '1' })}>
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setPreset(p);
                setSearch('');
              }}
              className={css({
                px: '2.5',
                py: '1',
                fontSize: 'xs',
                fontWeight: 'medium',
                borderRadius: 'lg',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: resolvedPreset === p ? 'accent.subtleBorder' : 'bd.strong',
                bg: resolvedPreset === p ? 'accent.subtle' : 'bg.surface',
                color: resolvedPreset === p ? 'accent.text' : 'fg.muted',
                _hover: { bg: resolvedPreset === p ? 'accent.subtle' : 'bg.muted' },
                _cyberpunk: {
                  boxShadow:
                    resolvedPreset === p
                      ? '0 0 10px #FDF500, 0 0 20px rgba(253, 245, 0, 0.3)'
                      : 'none',
                },
              })}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isLoading}
          className={css({
            ml: 'auto',
            fontSize: 'xs',
            color: 'fg.faint',
            cursor: 'pointer',
            _hover: { color: 'fg.muted' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          ↺ Actualiser
        </button>
      </div>
      <p className={css({ fontSize: 'xs', color: 'fg.faint', mt: '-1' })}>
        {PRESET_DESCRIPTIONS[resolvedPreset]}
      </p>

      {/* Search */}
      <input
        type="text"
        placeholder="Filtrer par système…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={css({
          px: '3',
          py: '2',
          fontSize: 'sm',
          border: '1px solid',
          borderColor: 'bd.strong',
          borderRadius: 'lg',
          outline: 'none',
          bg: 'bg.surface',
          _focusVisible: {
            borderColor: 'accent.hover',
            ring: '2px',
            ringColor: 'accent.subtleBorder',
            _cyberpunk: { borderColor: '#37EBF3', ringColor: '#37EBF3' },
          },
        })}
      />

      {/* States */}
      {isLoading && (
        <p className={css({ fontSize: 'sm', color: 'fg.faint' })}>
          Chargement de la liste depuis GitHub…
        </p>
      )}

      {listError instanceof Error && (
        <p role="alert" className={css({ fontSize: 'sm', color: 'status.danger.text' })}>
          {listError.message}
        </p>
      )}

      {loadError && (
        <p role="alert" className={css({ fontSize: 'sm', color: 'status.danger.text' })}>
          {loadError}
        </p>
      )}

      {/* System list */}
      {!isLoading && filtered.length === 0 && !listError && (
        <p className={css({ fontSize: 'sm', color: 'fg.faint' })}>
          {search ? 'Aucun système trouvé.' : 'Aucun DAT disponible pour ce preset.'}
        </p>
      )}

      {filtered.length > 0 && (
        <div
          className={css({
            bg: 'bg.surface',
            border: '1px solid',
            borderColor: 'bd.default',
            borderRadius: 'xl',
            overflow: 'hidden',
            maxH: '72',
            overflowY: 'auto',
          })}
        >
          {filtered.map((entry) => {
            const isLoading = loadingPath === entry.path;
            const isLoaded = loadedPaths.has(entry.path);
            return (
              <div
                key={entry.path}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3',
                  px: '3',
                  py: '2.5',
                  borderBottom: '1px solid',
                  borderColor: 'bd.subtle',
                  _last: { borderBottom: 'none' },
                  _hover: { bg: 'bg.muted' },
                })}
              >
                <span className={css({ flex: 1, fontSize: 'sm', color: 'fg.default' })}>
                  {entry.system}
                </span>
                <button
                  onClick={() => handleLoad(entry)}
                  disabled={loadMutation.isPending}
                  className={css({
                    px: '2.5',
                    py: '1',
                    fontSize: 'xs',
                    fontWeight: 'medium',
                    bg: isLoaded ? 'status.success.subtle' : 'accent.solid',
                    color: isLoaded ? 'status.success.text' : 'accent.fg',
                    border: isLoaded ? '1px solid' : 'none',
                    borderColor: 'status.success.subtleBorder',
                    borderRadius: 'lg',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'background-color 0.15s',
                    _hover: { bg: isLoaded ? 'status.success.subtle' : 'accent.hover' },
                    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                  })}
                >
                  {isLoading ? 'Chargement…' : isLoaded ? '✓ Chargé' : 'Charger'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
