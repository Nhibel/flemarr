import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { css, cx } from '@/styled-system/css';
import { getSettings, updateSettings, validateDir } from '@/lib/api.js';
import type { Settings } from '@/lib/api.js';

type Fresh1g1rPreset = Settings['fresh1g1rPreset'];
const PRESETS: Fresh1g1rPreset[] = ['PropeR', 'McLean', 'Hearto'];
type ValidationState = 'idle' | 'checking' | 'valid' | 'not-found' | 'not-dir';

interface Props {
  onClose: () => void;
}

export function SettingsPage({ onClose }: Props) {
  const queryClient = useQueryClient();
  const {
    data: settings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (updated) => {
      queryClient.setQueryData(['settings'], updated);
    },
  });

  const [newSystem, setNewSystem] = useState('');
  const [newPath, setNewPath] = useState('');
  const [validation, setValidation] = useState<ValidationState>('idle');

  if (isLoading) {
    return (
      <main className={css({ maxW: '2xl', mx: 'auto', mt: '16', px: '6' })}>
        <p className={css({ color: 'gray.400', fontSize: 'sm' })}>Chargement…</p>
      </main>
    );
  }

  if (error instanceof Error || !settings) {
    return (
      <main className={css({ maxW: '2xl', mx: 'auto', mt: '16', px: '6' })}>
        <p role="alert" className={css({ color: 'red.600', fontSize: 'sm' })}>
          {error instanceof Error ? error.message : 'Erreur de chargement'}
        </p>
      </main>
    );
  }

  const handlePreset = (preset: Fresh1g1rPreset) => {
    mutation.mutate({ fresh1g1rPreset: preset });
  };

  const handleConcurrency = (value: number) => {
    mutation.mutate({ downloaderConcurrency: value });
  };

  const handleValidatePath = async () => {
    const path = newPath.trim();
    if (!path) return;
    setValidation('checking');
    try {
      const result = await validateDir(path);
      if (!result.exists) setValidation('not-found');
      else if (!result.isDirectory) setValidation('not-dir');
      else setValidation('valid');
    } catch {
      setValidation('not-found');
    }
  };

  const handleAddPath = () => {
    const system = newSystem.trim();
    const path = newPath.trim();
    if (!system || !path || validation !== 'valid') return;
    mutation.mutate({ systemPaths: { [system]: path } });
    setNewSystem('');
    setNewPath('');
    setValidation('idle');
  };

  const handleRemovePath = (system: string) => {
    mutation.mutate({ systemPaths: { [system]: '' } });
  };

  const inputClass = css({
    px: '3',
    py: '1.5',
    fontSize: 'sm',
    border: '1px solid',
    borderColor: 'gray.300',
    borderRadius: 'md',
    outline: 'none',
    _focusVisible: { borderColor: 'blue.400', ring: '2px', ringColor: 'blue.100' },
  });

  const sectionClass = css({
    pb: '6',
    mb: '6',
    borderBottom: '1px solid',
    borderColor: 'gray.100',
    _last: { borderBottom: 'none', mb: '0', pb: '0' },
  });

  const validationHint =
    validation === 'valid'
      ? { text: '✓ Dossier trouvé', color: 'green.600' }
      : validation === 'not-found'
        ? { text: '✗ Chemin introuvable', color: 'red.600' }
        : validation === 'not-dir'
          ? { text: "✗ Ce chemin existe mais n'est pas un dossier", color: 'red.600' }
          : null;

  return (
    <main className={css({ maxW: '2xl', mx: 'auto', mt: '16', px: '6', pb: '12' })}>
      <div className={css({ display: 'flex', alignItems: 'baseline', gap: '4', mb: '8' })}>
        <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'gray.800', flex: 1 })}>
          Paramètres
        </h1>
        <button
          onClick={onClose}
          className={css({
            fontSize: 'sm',
            color: 'blue.600',
            cursor: 'pointer',
            _hover: { textDecoration: 'underline' },
          })}
        >
          ← Retour
        </button>
      </div>

      {mutation.isError && (
        <p role="alert" className={css({ mb: '4', fontSize: 'sm', color: 'red.600' })}>
          {mutation.error instanceof Error ? mutation.error.message : 'Erreur de sauvegarde'}
        </p>
      )}

      {/* Fresh1G1R preset */}
      <section className={sectionClass}>
        <h2
          className={css({ fontSize: 'base', fontWeight: 'semibold', color: 'gray.700', mb: '3' })}
        >
          Preset Fresh1G1R
        </h2>
        <div className={css({ display: 'flex', gap: '2' })}>
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => handlePreset(p)}
              disabled={mutation.isPending}
              className={css({
                px: '3',
                py: '1.5',
                fontSize: 'sm',
                fontWeight: 'medium',
                borderRadius: 'md',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: settings.fresh1g1rPreset === p ? 'blue.400' : 'gray.300',
                bg: settings.fresh1g1rPreset === p ? 'blue.50' : 'white',
                color: settings.fresh1g1rPreset === p ? 'blue.700' : 'gray.600',
                _hover: { bg: settings.fresh1g1rPreset === p ? 'blue.50' : 'gray.50' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      {/* Downloader concurrency */}
      <section className={sectionClass}>
        <h2
          className={css({ fontSize: 'base', fontWeight: 'semibold', color: 'gray.700', mb: '1' })}
        >
          Téléchargements simultanés
        </h2>
        <p className={css({ fontSize: 'xs', color: 'gray.400', mb: '3' })}>
          Nombre de fichiers téléchargés en parallèle (1–8). Archive.org est sensible aux rafales —
          2 est recommandé.
        </p>
        <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
          <input
            type="number"
            min={1}
            max={8}
            value={settings.downloaderConcurrency}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (v >= 1 && v <= 8) handleConcurrency(v);
            }}
            disabled={mutation.isPending}
            className={cx(css({ width: '16', textAlign: 'center' }), inputClass)}
          />
          <span className={css({ fontSize: 'sm', color: 'gray.500' })}>simultané(s)</span>
        </div>
      </section>

      {/* System paths */}
      <section className={sectionClass}>
        <h2
          className={css({ fontSize: 'base', fontWeight: 'semibold', color: 'gray.700', mb: '1' })}
        >
          Répertoires par système
        </h2>
        <p className={css({ fontSize: 'xs', color: 'gray.400', mb: '3' })}>
          Dossier de destination pour chaque système. Utilisé par le scanner et le téléchargeur.
        </p>

        {Object.keys(settings.systemPaths).length > 0 && (
          <div
            className={css({
              mb: '4',
              border: '1px solid',
              borderColor: 'gray.200',
              borderRadius: 'md',
              overflow: 'hidden',
            })}
          >
            {Object.entries(settings.systemPaths).map(([system, path]) => (
              <div
                key={system}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3',
                  px: '3',
                  py: '2',
                  borderBottom: '1px solid',
                  borderColor: 'gray.100',
                  _last: { borderBottom: 'none' },
                })}
              >
                <span
                  className={css({
                    fontSize: 'sm',
                    color: 'gray.700',
                    flex: 1,
                    minW: '0',
                    truncate: true,
                  })}
                >
                  {system}
                </span>
                <span
                  className={css({
                    fontSize: 'xs',
                    color: 'gray.400',
                    fontFamily: 'mono',
                    flex: 1,
                    minW: '0',
                    truncate: true,
                  })}
                >
                  {path}
                </span>
                <button
                  onClick={() => handleRemovePath(system)}
                  disabled={mutation.isPending}
                  className={css({
                    fontSize: 'xs',
                    color: 'red.500',
                    cursor: 'pointer',
                    flexShrink: 0,
                    _hover: { color: 'red.700' },
                    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                  })}
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new path — two-step: verify then confirm */}
        <div className={css({ display: 'flex', flexDirection: 'column', gap: '2' })}>
          <input
            type="text"
            placeholder="Système (ex: Nintendo - Super Nintendo Entertainment System)"
            value={newSystem}
            onChange={(e) => setNewSystem(e.target.value)}
            className={inputClass}
          />
          <div className={css({ display: 'flex', gap: '2', alignItems: 'center' })}>
            <input
              type="text"
              placeholder="Chemin absolu (ex: C:\Roms\SNES)"
              value={newPath}
              onChange={(e) => {
                setNewPath(e.target.value);
                setValidation('idle');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && validation === 'idle') void handleValidatePath();
              }}
              className={cx(css({ flex: '1' }), inputClass)}
            />
            <button
              onClick={() => void handleValidatePath()}
              disabled={!newPath.trim() || validation === 'checking'}
              className={css({
                px: '3',
                py: '1.5',
                fontSize: 'sm',
                fontWeight: 'medium',
                border: '1px solid',
                borderColor: 'gray.300',
                bg: 'white',
                color: 'gray.600',
                borderRadius: 'md',
                cursor: 'pointer',
                flexShrink: 0,
                _hover: { bg: 'gray.50' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {validation === 'checking' ? 'Vérification…' : 'Vérifier'}
            </button>
            <button
              onClick={handleAddPath}
              disabled={!newSystem.trim() || validation !== 'valid' || mutation.isPending}
              className={css({
                px: '3',
                py: '1.5',
                fontSize: 'sm',
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
              Ajouter
            </button>
          </div>
          {validationHint && (
            <p className={css({ fontSize: 'xs', color: validationHint.color })}>
              {validationHint.text}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
