import { css } from '@/styled-system/css';
import type { UpdateSettings } from '@/lib/api.js';
import { TOPOLOGY_OPTIONS, TOPOLOGY_PATCHES } from './topology.js';

export function TopologyStep({
  saving,
  onChoose,
}: {
  saving: boolean;
  onChoose: (patch: UpdateSettings) => void;
}) {
  // No page shell and no heading of its own: InstallFlow provides both, and
  // this step is only ever rendered inside it. It used to be a standalone
  // screen, which is why the shell was here.
  return (
    <div>
      <p className={css({ fontSize: 'sm', color: 'fg.muted', mb: '6', lineHeight: '1.6' })}>
        Une seule question, posée une fois pour toute l&apos;application. C&apos;est elle qui
        détermine où arrivent les téléchargements et si rom-curator peut reconnaître ce que tu
        possèdes déjà.
      </p>

      <div className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
        {TOPOLOGY_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={saving}
            onClick={() => onChoose(TOPOLOGY_PATCHES[o.value])}
            className={css({
              display: 'block',
              textAlign: 'left',
              px: '4',
              py: '4',
              bg: 'bg.surface',
              border: 'none',
              borderRadius: '16px',
              shadow: 'md',
              cursor: 'pointer',
              transition: 'background-color 0.15s',
              _hover: { bg: 'bg.muted' },
              _disabled: { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            <span
              className={css({
                display: 'flex',
                alignItems: 'baseline',
                gap: '2',
                flexWrap: 'wrap',
              })}
            >
              <span
                className={css({ fontFamily: 'display', fontWeight: 'bold', color: 'fg.heading' })}
              >
                {o.title}
              </span>
              {o.hint && (
                <span
                  className={css({
                    px: '2',
                    py: '0.5',
                    borderRadius: '8px',
                    bg: 'accent.subtle',
                    color: 'accent.text',
                    fontSize: '2xs',
                    fontWeight: 'semibold',
                  })}
                >
                  {o.hint}
                </span>
              )}
            </span>
            <span
              className={css({ display: 'block', mt: '1.5', fontSize: 'sm', color: 'fg.muted' })}
            >
              {o.body}
            </span>
          </button>
        ))}
      </div>

      <p className={css({ mt: '6', fontSize: 'xs', color: 'fg.faint' })}>
        Tu pourras changer d&apos;avis dans les réglages. Ce choix ne touche jamais à tes fichiers :
        il décide seulement de ce que rom-curator a le droit de lire et d&apos;écrire.
      </p>
    </div>
  );
}
