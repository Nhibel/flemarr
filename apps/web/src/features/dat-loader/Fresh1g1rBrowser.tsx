import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { css } from '@/styled-system/css';
import { listDatSources, fetchDatFromFresh1g1r, getSettings } from '@/lib/api.js';
import type { Fresh1g1rPreset, ListSourcesResponse } from '@/lib/api.js';
import type { DatUploadResponse } from '@shared/api.js';

const PRESETS: Fresh1g1rPreset[] = ['PropeR', 'McLean', 'Hearto'];

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
    loadMutation.mutate(entry, { onSettled: () => setLoadingPath(null) });
  };

  return (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
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
                borderRadius: 'md',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: resolvedPreset === p ? 'blue.400' : 'bd.strong',
                bg: resolvedPreset === p ? 'blue.50' : 'bg.page',
                color: resolvedPreset === p ? 'blue.700' : 'fg.muted',
                _hover: { bg: resolvedPreset === p ? 'blue.50' : 'bg.surface' },
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
          borderRadius: 'md',
          outline: 'none',
          _focusVisible: { borderColor: 'blue.400', ring: '2px', ringColor: 'blue.100' },
        })}
      />

      {/* States */}
      {isLoading && (
        <p className={css({ fontSize: 'sm', color: 'fg.faint' })}>
          Chargement de la liste depuis GitHub…
        </p>
      )}

      {listError instanceof Error && (
        <p role="alert" className={css({ fontSize: 'sm', color: 'red.600' })}>
          {listError.message}
        </p>
      )}

      {loadError && (
        <p role="alert" className={css({ fontSize: 'sm', color: 'red.600' })}>
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
            border: '1px solid',
            borderColor: 'bd.default',
            borderRadius: 'md',
            overflow: 'hidden',
            maxH: '72',
            overflowY: 'auto',
          })}
        >
          {filtered.map((entry) => {
            const isLoading = loadingPath === entry.path;
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
                  _hover: { bg: 'bg.surface' },
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
                    bg: 'blue.500',
                    color: 'white',
                    borderRadius: 'md',
                    cursor: 'pointer',
                    flexShrink: 0,
                    _hover: { bg: 'blue.600' },
                    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                  })}
                >
                  {isLoading ? 'Chargement…' : 'Charger'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
