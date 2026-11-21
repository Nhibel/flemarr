import { css } from '@/styled-system/css';
import type { SettingsResponse, UpdateSettings } from '@/lib/api.js';
import { sectionClass } from './styles.js';
import {
  TOPOLOGY_OPTIONS,
  TOPOLOGY_PATCHES,
  inferTopology,
} from '@/features/onboarding/topology.js';

/**
 * The same question the install flow asks, as the place to change the
 * answer later — not a second, differently-worded control over the same
 * setting. This replaced a "Destination des téléchargements" section that
 * offered server-or-browser directly: that is the consequence of this
 * choice, not a separate decision, and having both on screen was the
 * duplication the design canvas called out.
 */
export function TopologySection({
  settings,
  saving,
  onSave,
}: {
  settings: SettingsResponse;
  saving: boolean;
  onSave: (patch: UpdateSettings) => void;
}) {
  const current = inferTopology(settings);

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
        Où arrivent les jeux téléchargés ?
      </h2>
      <p className={css({ fontSize: 'xs', color: 'fg.faint', mb: '3' })}>
        Décide aussi si Flemarr peut reconnaître ce que tu possèdes déjà. Ce choix ne touche jamais
        à tes fichiers.
      </p>
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '1.5' })}>
        {TOPOLOGY_OPTIONS.map((o) => {
          const active = current === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onSave(TOPOLOGY_PATCHES[o.value])}
              disabled={saving}
              className={css({
                display: 'block',
                textAlign: 'left',
                px: '3',
                py: '2.5',
                borderRadius: '12px',
                cursor: 'pointer',
                border: 'none',
                bg: active ? 'accent.subtle' : 'bg.muted',
                transition: 'background-color 0.15s',
                _hover: { bg: active ? 'accent.subtle' : 'bg.surface' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              <span
                className={css({
                  display: 'block',
                  fontSize: 'sm',
                  fontWeight: active ? 'bold' : 'medium',
                  color: active ? 'accent.text' : 'fg.default',
                })}
              >
                {o.title}
              </span>
              <span
                className={css({ display: 'block', mt: '0.5', fontSize: 'xs', color: 'fg.muted' })}
              >
                {o.body}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
