import { css } from '@/styled-system/css';
import { Button } from '@/components/Button.js';
import { Card } from '@/components/Card.js';
import { MIN_FONT_SCALE, MAX_FONT_SCALE, FONT_SCALE_STEP } from '@/lib/use-font-scale.js';

interface Props {
  fontScale: number;
  onSetFontScale: (px: number) => void;
}

// Pinned to the viewport with `position: fixed` — deliberately NOT inside
// any page's normal flow, and mounted once at the App root rather than per
// view, so it (a) never moves on screen when fontScale itself changes
// everything else's size around it, and (b) is reachable from every
// screen, not just Réglages.
export function FontScaleControl({ fontScale, onSetFontScale }: Props) {
  return (
    <Card
      className={css({
        position: 'fixed',
        insetInlineEnd: '4',
        insetBlockEnd: '4',
        zIndex: '50',
        display: 'flex',
        alignItems: 'center',
        gap: '2',
        px: '2',
        py: '1',
        shadow: 'md',
      })}
    >
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
          minW: '10',
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
    </Card>
  );
}
