import { css } from '@/styled-system/css';
import { MIN_FONT_SCALE, MAX_FONT_SCALE, FONT_SCALE_STEP } from '@/lib/use-font-scale.js';

interface Props {
  fontScale: number;
  onSetFontScale: (px: number) => void;
}

// Every size-affecting value here is a literal px, never a Panda token —
// tokens (fontSize, px/py, borderRadius, gap...) are all rem-based and
// scale with the very --font-scale variable this control adjusts, which
// would make the control itself grow/shrink as it's used. Colors still go
// through semantic tokens so theming (dark mode, the named themes) keeps
// working; only sizing is hardcoded.
const btnStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
  fontSize: '12px',
  lineHeight: '1',
  fontWeight: 'medium',
  borderRadius: '5px',
  bg: 'bg.surface',
  color: 'fg.default',
  cursor: 'pointer',
  transition: 'background-color 0.15s',
  _hover: { bg: 'bg.muted' },
  _disabled: { opacity: 0.5, cursor: 'not-allowed' },
});

// position: fixed, anchored to the viewport — not inline next to the
// Lexique/Réglages icons. Inline isn't an option here: those icons live
// inside the same rem-scaling header (h1 font-size, margins, gaps) this
// control adjusts, so sitting among them would still visibly shift its own
// position every time fontScale changes, even with its own internal
// sizing hardcoded to px. Anchoring to the viewport corner instead of the
// page's own layout is the only way to make "never moves" actually true;
// top-right keeps it visually close to where those icons usually are.
export function FontScaleControl({ fontScale, onSetFontScale }: Props) {
  return (
    <div
      className={css({
        position: 'fixed',
        insetBlockStart: '16px',
        insetInlineEnd: '16px',
        zIndex: '50',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 6px',
        borderRadius: '9999px',
        bg: 'bg.surface',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      })}
    >
      <button
        type="button"
        onClick={() => onSetFontScale(fontScale - FONT_SCALE_STEP)}
        disabled={fontScale <= MIN_FONT_SCALE}
        aria-label="Réduire la taille du texte"
        className={btnStyle}
      >
        −
      </button>
      <span
        className={css({
          fontSize: '11px',
          color: 'fg.default',
          minWidth: '26px',
          textAlign: 'center',
        })}
      >
        {fontScale}px
      </span>
      <button
        type="button"
        onClick={() => onSetFontScale(fontScale + FONT_SCALE_STEP)}
        disabled={fontScale >= MAX_FONT_SCALE}
        aria-label="Agrandir la taille du texte"
        className={btnStyle}
      >
        +
      </button>
    </div>
  );
}
