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
                borderRadius: 'md',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: active ? 'blue.400' : 'bd.default',
                bg: active ? 'blue.50' : 'bg.page',
                _hover: { bg: active ? 'blue.50' : 'bg.surface' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                _dark: active ? { bg: 'blue.900', borderColor: 'blue.600' } : undefined,
              })}
            >
              <span
                className={css({
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  flexShrink: 0,
                  color: active ? 'blue.700' : 'fg.default',
                  _dark: active ? { color: 'blue.300' } : undefined,
                  w: '28',
                })}
              >
                {TARGET_LABELS[t]}
              </span>
              <span
                className={css({
                  fontSize: 'xs',
                  color: active ? 'blue.600' : 'fg.faint',
                  _dark: active ? { color: 'blue.400' } : undefined,
                })}
              >
                {TARGET_DESCRIPTIONS[t]}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
