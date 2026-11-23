import { css } from '@/styled-system/css';

/**
 * Class for the small header icon buttons (settings, lexique).
 *
 * A filled recess inside the header card, as in the comps, rather than a
 * bare glyph on the card: 36px square, radius 11px, bg.inset. Both are
 * literal px because they are a touch target and a corner — neither should
 * be rescaled by the live font-size control.
 *
 * Cyberpunk's artboard is the one that tints these icons: cyan, which is
 * also where that theme's status.info sits. The others use fg.subtle.
 */
export const iconBtnClass = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  w: '36px',
  h: '36px',
  color: 'fg.subtle',
  bg: 'bg.inset',
  border: 'none',
  cursor: 'pointer',
  borderRadius: '11px',
  transition: 'background-color 0.15s, color 0.15s',
  _nightdrive: { color: '#37EBF3' },
  _contraste: { color: '#37EBF3' },
  _hover: { color: 'fg.default', bg: 'bg.muted' },
});

export function BookIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/* Status pictograms for Chip. Each status is carried by hue, by the
   lightness of its tinted wash AND by one of these shapes, so the three
   remain distinguishable to an eye that confuses the hues — a red/green
   pair is never the only signal. Deliberately tiny and stroke-only: they
   sit inside a text-sized tag and must not outweigh the number next to
   them. `currentColor` makes each one inherit its tag's status color. */

export function CheckIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12.5l5.5 5.5L20 7" />
    </svg>
  );
}

export function WarningIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3.5L21 19H3z" />
      <path d="M12 10v4M12 16.5v.01" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Two overlapping sheets: another version of the same thing. */
export function VersionsIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 8h12v12H8z" />
      <path d="M4 16V4h12" />
    </svg>
  );
}

/** Magnifier for the header's inline search field. */
export function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
