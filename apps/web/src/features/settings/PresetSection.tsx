import { css } from '@/styled-system/css';
import type { SettingsResponse, UpdateSettings } from '@/lib/api.js';
import { sectionClass } from './styles.js';

type Fresh1g1rPreset = SettingsResponse['fresh1g1rPreset'];
const PRESETS: Fresh1g1rPreset[] = ['PropeR', 'McLean', 'Hearto'];
const PRESET_DESCRIPTIONS: Record<Fresh1g1rPreset, string> = {
  McLean: 'Anglais uniquement, jeux licenciés seulement. Sélection la plus stricte.',
  PropeR: 'Toutes langues · jeux, add-ons, bonus discs, éducatif. Officiel uniquement.',
  Hearto: 'Le plus large · toutes langues, démos, non-licenciés, proto/bêta/alpha.',
};

export function PresetSection({
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
        Preset Fresh1G1R
      </h2>
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '1.5' })}>
        {PRESETS.map((p) => {
          const active = settings.fresh1g1rPreset === p;
          return (
            <button
              key={p}
              onClick={() => onSave({ fresh1g1rPreset: p })}
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
                borderColor: active ? 'accent.hover' : 'bd.default',
                bg: active ? 'accent.subtle' : 'bg.page',
                transition: 'background-color 0.15s, border-color 0.15s',
                _hover: { bg: active ? 'accent.subtle' : 'bg.surface' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              <span
                className={css({
                  fontSize: 'sm',
                  fontWeight: 'semibold',
                  flexShrink: 0,
                  color: active ? 'accent.text' : 'fg.default',
                  w: '16',
                })}
              >
                {p}
              </span>
              <span className={css({ fontSize: 'xs', color: active ? 'accent.text' : 'fg.faint' })}>
                {PRESET_DESCRIPTIONS[p]}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
