import { css } from '@/styled-system/css';
import type { Settings, UpdateSettings } from '@/lib/api.js';
import { sectionClass } from './styles.js';

type Fresh1g1rPreset = Settings['fresh1g1rPreset'];
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
  settings: Settings;
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
                  w: '16',
                })}
              >
                {p}
              </span>
              <span
                className={css({
                  fontSize: 'xs',
                  color: active ? 'blue.600' : 'fg.faint',
                  _dark: active ? { color: 'blue.400' } : undefined,
                })}
              >
                {PRESET_DESCRIPTIONS[p]}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
