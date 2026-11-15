import { css } from '@/styled-system/css';

/**
 * A text field. No border: the global `input, textarea, select` rule in
 * panda.config.ts already draws fields as a filled recess (bg.inset,
 * radius 12px), which is how the comps draw them. This class only adds the
 * padding and the focus ring on top.
 */
export const inputClass = css({
  px: '3',
  py: '2',
  fontSize: 'sm',
  outline: 'none',
  _focusVisible: {
    ring: '2px',
    ringColor: 'accent.subtleBorder',
    _cyberpunk: { ringColor: '#37EBF3' },
  },
});

/**
 * One settings section as a floating card, not a block of page separated
 * from the next by a hairline. Same rule as everywhere else since the
 * redesign: depth from a shadow and from the surface being a different
 * tone than the page, never from a 1px line. A column of hairline-divided
 * blocks also read as one undifferentiated wall of page, which is the
 * opposite of what a settings screen needs.
 */
export const sectionClass = css({
  px: '4',
  py: '4',
  mb: '3',
  bg: 'bg.surface',
  borderRadius: '16px',
  shadow: 'md',
  _last: { mb: '0' },
});
