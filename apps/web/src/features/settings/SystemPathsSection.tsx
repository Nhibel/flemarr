import { useState } from 'react';
import { css } from '@/styled-system/css';
import { validateDir } from '@/lib/api.js';
import type { SettingsResponse, UpdateSettings } from '@/lib/api.js';
import { PathInput } from '@/components/PathInput.js';
import { inputClass, sectionClass } from './styles.js';

type ValidationState = 'idle' | 'checking' | 'valid' | 'not-found' | 'not-dir';

export function SystemPathsSection({
  settings,
  saving,
  onSave,
}: {
  settings: SettingsResponse;
  saving: boolean;
  onSave: (patch: UpdateSettings) => void;
}) {
  const [newSystem, setNewSystem] = useState('');
  const [newPath, setNewPath] = useState('');
  const [validation, setValidation] = useState<ValidationState>('idle');

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
    onSave({ systemPaths: { [system]: path } });
    setNewSystem('');
    setNewPath('');
    setValidation('idle');
  };

  const handleRemovePath = (system: string) => {
    onSave({ systemPaths: { [system]: '' } });
  };

  const validationHint =
    validation === 'valid'
      ? { text: '✓ Dossier trouvé', ok: true }
      : validation === 'not-found'
        ? { text: '✗ Chemin introuvable', ok: false }
        : validation === 'not-dir'
          ? { text: "✗ Ce chemin existe mais n'est pas un dossier", ok: false }
          : null;

  return (
    <section className={sectionClass}>
      <h2
        className={css({
          fontSize: 'base',
          fontWeight: 'semibold',
          color: 'fg.default',
          mb: '1',
        })}
      >
        Répertoires par système
      </h2>
      <p className={css({ fontSize: 'xs', color: 'fg.faint', mb: '3' })}>
        Dossier de destination pour chaque système. Utilisé par le scanner et le téléchargeur.
      </p>

      {Object.keys(settings.systemPaths).length > 0 && (
        <div
          className={css({
            mb: '4',
            border: '1px solid',
            borderColor: 'bd.default',
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
                borderColor: 'bd.subtle',
                _last: { borderBottom: 'none' },
              })}
            >
              <span
                className={css({
                  fontSize: 'sm',
                  color: 'fg.default',
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
                  color: 'fg.faint',
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
                disabled={saving}
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
          <PathInput
            value={newPath}
            onChange={(v) => {
              setNewPath(v);
              setValidation('idle');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && validation === 'idle') void handleValidatePath();
            }}
            placeholder="Chemin absolu (ex: C:\Roms\SNES)"
            inputClassName={inputClass}
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
              borderColor: 'bd.strong',
              bg: 'bg.page',
              color: 'fg.muted',
              borderRadius: 'md',
              cursor: 'pointer',
              flexShrink: 0,
              _hover: { bg: 'bg.surface' },
              _disabled: { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            {validation === 'checking' ? 'Vérification…' : 'Vérifier'}
          </button>
          <button
            onClick={handleAddPath}
            disabled={!newSystem.trim() || validation !== 'valid' || saving}
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
          <p
            className={css({
              fontSize: 'xs',
              color: validationHint.ok ? 'green.600' : 'red.600',
            })}
          >
            {validationHint.text}
          </p>
        )}
      </div>
    </section>
  );
}
