import { css, cx } from '@/styled-system/css';
import { Button } from '@/components/Button.js';
import type { Theme } from '@/lib/use-theme.js';
import { MIN_FONT_SCALE, MAX_FONT_SCALE, FONT_SCALE_STEP } from '@/lib/use-font-scale.js';
import { inputClass, sectionClass } from './styles.js';

const THEMES: Theme[] = [
  'light',
  'dark',
  'catppuccin',
  'cyberpunk',
  'matrix',
  'nintendo',
  'megadrive',
  'sonicmania',
];
const THEME_LABELS: Record<Theme, string> = {
  light: 'Clair',
  dark: 'Sombre',
  catppuccin: 'Catppuccin',
  cyberpunk: 'Cyberpunk',
  matrix: 'Matrix',
  nintendo: 'Nintendo',
  megadrive: 'Megadrive',
  sonicmania: 'Sonic Mania',
};
const THEME_DESCRIPTIONS: Record<Theme, string> = {
  light: 'Fond blanc, texte sombre.',
  dark: 'Fond sombre neutre, texte clair.',
  catppuccin: 'Mocha — pastel sur fond bleu-nuit.',
  cyberpunk: 'Noir, jaune néon et cyan électrique.',
  matrix: 'Néon vert/jaune sur fond quasi noir.',
  nintendo: 'Fond bleu, cartes rouge Mario, accents et sélection or.',
  megadrive: 'Fond et cartes bleu Sonic vif, accents et sélection rouge.',
  sonicmania: 'Fond jaune, cartes cyan, accent or et sélection rose-rouge.',
};

// Unlike the other sections here, this isn't a server-persisted setting —
// it's local/client state (localStorage) straight from useTheme(), so no
// settings/onSave/saving props. A <select> rather than the usual button
// list (still used elsewhere, e.g. PresetSection) once there were 7 themes
// to scroll through instead of 2-3.
export function AppearanceSection({
  theme,
  onSetTheme,
  fontScale,
  onSetFontScale,
}: {
  theme: Theme;
  onSetTheme: (t: Theme) => void;
  fontScale: number;
  onSetFontScale: (px: number) => void;
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
      <select
        value={theme}
        onChange={(e) => onSetTheme(e.target.value as Theme)}
        className={cx(inputClass, css({ cursor: 'pointer', maxW: 'xs' }))}
      >
        {THEMES.map((t) => (
          <option key={t} value={t}>
            {THEME_LABELS[t]}
          </option>
        ))}
      </select>
      <p className={css({ fontSize: 'xs', color: 'fg.faint', mt: '2' })}>
        {THEME_DESCRIPTIONS[theme]}
      </p>

      {/* Also client-only (localStorage), like the theme above — see
          apps/web/src/lib/use-font-scale.ts. Drives a CSS variable that
          every rem-based token in the app (text, padding/gap, maxW
          widths) scales from, so this one control resizes the whole UI
          live, no reload needed. */}
      <div className={css({ mt: '4' })}>
        <p className={css({ fontSize: 'sm', color: 'fg.default', mb: '2' })}>Taille du texte</p>
        <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onSetFontScale(fontScale - FONT_SCALE_STEP)}
            disabled={fontScale <= MIN_FONT_SCALE}
            aria-label="Réduire la taille du texte"
          >
            −
          </Button>
          <span
            className={css({
              fontSize: 'sm',
              color: 'fg.default',
              minW: '12',
              textAlign: 'center',
            })}
          >
            {fontScale}px
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onSetFontScale(fontScale + FONT_SCALE_STEP)}
            disabled={fontScale >= MAX_FONT_SCALE}
            aria-label="Agrandir la taille du texte"
          >
            +
          </Button>
        </div>
      </div>
    </section>
  );
}
