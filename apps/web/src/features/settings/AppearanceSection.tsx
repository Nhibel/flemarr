import { css, cx } from '@/styled-system/css';
import type { Theme } from '@/lib/use-theme.js';
import { inputClass, sectionClass } from './styles.js';

// Display order, not the same as the Theme union's order: the two neutral
// themes first (what most people want), then the three stylized ones, then
// Contraste last as the high-legibility option.
const THEMES: Theme[] = [
  'light',
  'dark',
  'catppuccin',
  'cyberpunk',
  'matrix',
  'sonicmania',
  'contraste',
];
const THEME_LABELS: Record<Theme, string> = {
  light: 'Clair',
  dark: 'Sombre',
  catppuccin: 'Catppuccin',
  cyberpunk: 'Cyberpunk',
  matrix: 'Matrix',
  sonicmania: 'Sonic Mania',
  contraste: 'Contraste',
};
const THEME_DESCRIPTIONS: Record<Theme, string> = {
  light: 'Fond papier chaud, cartes blanches, accent bleu.',
  dark: 'Encre bleutée, texte clair, accent bleu vif.',
  catppuccin: 'Mocha — pastel sur fond bleu-nuit.',
  cyberpunk: 'Violet saturé, titre jaune néon, étiquettes pleines, données en cyan.',
  matrix: 'Néon vert sur fond quasi noir.',
  sonicmania: 'Fond jaune vif, cartes cyan, accent magenta et or.',
  contraste:
    'Noir franc, titre jaune néon, cyan électrique et rose — le plus lisible à distance.',
};

// Unlike the other sections here, this isn't a server-persisted setting —
// it's local/client state (localStorage) straight from useTheme(), so no
// settings/onSave/saving props. A <select> rather than the usual button
// list (still used elsewhere, e.g. PresetSection) once there were 7 themes
// to scroll through instead of 2-3.
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
    </section>
  );
}
