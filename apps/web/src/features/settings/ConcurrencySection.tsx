import { css, cx } from '@/styled-system/css';
import type { SettingsResponse, UpdateSettings } from '@/lib/api.js';
import { inputClass, sectionClass } from './styles.js';

export function ConcurrencySection({
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
          mb: '1',
        })}
      >
        Téléchargements simultanés
      </h2>
      <p className={css({ fontSize: 'xs', color: 'fg.faint', mb: '3' })}>
        Nombre de fichiers téléchargés en parallèle (1–8). Archive.org est sensible aux rafales — 2
        est recommandé.
      </p>
      <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
        <input
          type="number"
          min={1}
          max={8}
          value={settings.downloaderConcurrency}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (v >= 1 && v <= 8) onSave({ downloaderConcurrency: v });
          }}
          disabled={saving}
          className={cx(css({ width: '16', textAlign: 'center' }), inputClass)}
        />
        <span className={css({ fontSize: 'sm', color: 'fg.subtle' })}>simultané(s)</span>
      </div>
    </section>
  );
}
