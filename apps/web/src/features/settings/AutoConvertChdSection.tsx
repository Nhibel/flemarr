import { css } from '@/styled-system/css';
import type { SettingsResponse, UpdateSettings } from '@/lib/api.js';
import { sectionClass } from './styles.js';

export function AutoConvertChdSection({
  settings,
  saving,
  onSave,
}: {
  settings: SettingsResponse;
  saving: boolean;
  onSave: (patch: UpdateSettings) => void;
}) {
  return (
    <section className={sectionClass}>
      <h2
        className={css({
          fontSize: 'base',
          fontWeight: 'semibold',
          color: 'fg.default',
          mb: '3',
        })}
      >
        Conversion CHD
      </h2>
      <label
        className={css({
          display: 'flex',
          alignItems: 'flex-start',
          gap: '2',
          cursor: 'pointer',
        })}
      >
        <input
          type="checkbox"
          checked={settings.autoConvertChd}
          disabled={saving}
          onChange={(e) => onSave({ autoConvertChd: e.target.checked })}
          className={css({ mt: '0.5' })}
        />
        <span className={css({ fontSize: 'sm', color: 'fg.default' })}>
          Convertir automatiquement les jeux disque (.bin/.cue) en .chd après téléchargement
          <br />
          <span className={css({ fontSize: 'xs', color: 'fg.faint' })}>
            Les fichiers d'origine sont supprimés une fois le .chd vérifié bit à bit. S'applique
            aussi bien aux téléchargements vers le serveur qu'en mode navigateur (un seul fichier
            .chd est alors proposé, au lieu du .bin et du .cue séparément).
          </span>
        </span>
      </label>
    </section>
  );
}
