import { css } from '@/styled-system/css';
import type { SettingsResponse, UpdateSettings } from '@/lib/api.js';
import { sectionClass } from './styles.js';

type DownloadTarget = SettingsResponse['downloadTarget'];
const TARGETS: DownloadTarget[] = ['server', 'browser'];
const TARGET_LABELS: Record<DownloadTarget, string> = {
  server: 'Serveur',
  browser: 'Mon navigateur',
};
const TARGET_DESCRIPTIONS: Record<DownloadTarget, string> = {
  server: "Placé directement dans le dossier système configuré ci-dessous, sur l'homelab.",
  browser:
    'Enregistré via votre navigateur (dossier Téléchargements, ou au choix selon ses réglages). Le dossier système reste utilisé pour le scan une fois les fichiers rangés.',
};

export function DownloadTargetSection({
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
        Destination des téléchargements
      </h2>
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '1.5' })}>
        {TARGETS.map((t) => {
          const active = settings.downloadTarget === t;
          return (
            <button
              key={t}
              onClick={() => onSave({ downloadTarget: t })}
              disabled={saving}
              className={css({
                display: 'flex',
                alignItems: 'baseline',
                gap: '3',
                px: '3',
                py: '2',
                textAlign: 'left',
                borderRadius: 'lg',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: active ? 'accent.subtleBorder' : 'bd.default',
                bg: active ? 'accent.subtle' : 'bg.surface',
                transition: 'background-color 0.15s, border-color 0.15s',
                _hover: { bg: active ? 'accent.subtle' : 'bg.muted' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                _cyberpunk: {
                  boxShadow: active ? '0 0 10px #FDF500, 0 0 20px rgba(253, 245, 0, 0.3)' : 'none',
                },
              })}
            >
              <span
                className={css({
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  flexShrink: 0,
                  color: active ? 'accent.text' : 'fg.default',
                  w: '28',
                })}
              >
                {TARGET_LABELS[t]}
              </span>
              <span className={css({ fontSize: 'xs', color: active ? 'accent.text' : 'fg.faint' })}>
                {TARGET_DESCRIPTIONS[t]}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
