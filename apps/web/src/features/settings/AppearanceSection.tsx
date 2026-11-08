import { css } from '@/styled-system/css';
import type { Theme } from '@/lib/use-theme.js';
import { sectionClass } from './styles.js';

const THEMES: Theme[] = ['light', 'dark', 'catppuccin', 'cyberpunk'];
const THEME_LABELS: Record<Theme, string> = {
  light: 'Clair',
  dark: 'Sombre',
  catppuccin: 'Catppuccin',
  cyberpunk: 'Cyberpunk',
};
const THEME_DESCRIPTIONS: Record<Theme, string> = {
  light: 'Fond blanc, texte sombre.',
  dark: 'Fond sombre neutre, texte clair.',
  catppuccin: 'Mocha — pastel sur fond bleu-nuit.',
  cyberpunk: 'Néon vert/jaune sur fond quasi noir.',
};

// Unlike the other sections here, this isn't a server-persisted setting —
// it's local/client state (localStorage) straight from useTheme(), so no
// settings/onSave/saving props.
export function AppearanceSection({
  theme,
  onSetTheme,
}: {
  theme: Theme;
  onSetTheme: (t: Theme) => void;
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
        Apparence
      </h2>
      <div className={css({ display: 'flex', flexDirection: 'column', gap: '1.5' })}>
        {THEMES.map((t) => {
          const active = theme === t;
          return (
            <button
              key={t}
              onClick={() => onSetTheme(t)}
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
                {THEME_LABELS[t]}
              </span>
              <span className={css({ fontSize: 'xs', color: active ? 'accent.text' : 'fg.faint' })}>
                {THEME_DESCRIPTIONS[t]}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
