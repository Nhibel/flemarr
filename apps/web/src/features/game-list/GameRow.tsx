import { css } from '@/styled-system/css';
import type { Game } from '@shared/dat.js';
import type { DisplayMode } from './use-display-mode.js';

function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function totalSize(game: Game): number {
  return game.roms.reduce((s, r) => s + r.size, 0);
}

interface Props {
  game: Game;
  isSelected: boolean;
  isFocused: boolean;
  onToggle: (id: string) => void;
  /** Backend proxy URL of the boxart; undefined = none known (placeholder). */
  boxartSrc?: string;
  mode?: DisplayMode;
  style?: React.CSSProperties;
}

export function GameRow({
  game,
  isSelected,
  isFocused,
  onToggle,
  boxartSrc,
  mode = 'normal',
  style,
}: Props) {
  // Boxart slot size; compact mode has no slot at all. A literal px, not a
  // spacing token: the art is a fixed-size image slot, and a rem value
  // would be rescaled by the live font-size control
  // (src/lib/use-font-scale.ts) independently of the image inside it.
  const artSize = mode === 'compact' ? '0px' : '44px';
  return (
    <div
      role="option"
      aria-selected={isSelected}
      data-focused={isFocused || undefined}
      style={style}
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '3',
        px: '3',
        py: '1.5',
        // 56px of rhythm per row (44px art + breathing room), as a floor
        // rather than a fixed height so a long name that wraps, or a large
        // font-scale setting, can still grow the row instead of clipping.
        minH: mode === 'compact' ? '40px' : '56px',
        // The selection/hover highlight is an inset rounded block, not a
        // band running edge to edge: the list is a rounded card now, and a
        // full-bleed highlight on the first or last row would square off
        // its corners. mx + a literal radius keep it clear of them.
        mx: '1.5',
        borderRadius: '12px',
        bg: isSelected ? 'accent.subtle' : isFocused ? 'bg.muted' : 'transparent',
        // Inset, so the keyboard focus ring also stays inside the card.
        outline: isFocused ? '2px solid token(colors.accent.solid)' : 'none',
        outlineOffset: '-2px',
        cursor: 'pointer',
        userSelect: 'none',
        _hover: { bg: isSelected ? 'accent.subtle' : 'bg.muted' },
      })}
      onClick={() => onToggle(game.id)}
    >
      {/* Decorative only — the row's own onClick is the single toggle source.
          pointer-events:none stops a direct click on the checkbox square from
          bubbling into the row's onClick as a second, canceling toggle. */}
      <input
        type="checkbox"
        checked={isSelected}
        aria-hidden
        tabIndex={-1}
        readOnly
        className={css({ flexShrink: 0, pointerEvents: 'none' })}
      />

      {mode !== 'compact' &&
        (boxartSrc ? (
          <img
            src={boxartSrc}
            alt=""
            loading="lazy"
            style={{ width: artSize, height: artSize }}
            className={css({
              objectFit: 'contain',
              flexShrink: 0,
              borderRadius: '10px',
            })}
          />
        ) : (
          <span
            aria-hidden
            style={{ width: artSize, height: artSize }}
            className={css({
              flexShrink: 0,
              borderRadius: '10px',
              bg: 'bg.muted',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'fg.faint',
              // The first letter of the title rather than a "?": at 44px
              // the slot is big enough to read as a real element, and an
              // initial distinguishes neighbouring rows while the actual
              // art loads (or when none exists at all).
              fontFamily: 'display',
              fontSize: 'sm',
              fontWeight: 'bold',
            })}
          >
            {game.name.slice(0, 1).toUpperCase()}
          </span>
        ))}

      <span className={css({ flex: 1, minW: '0' })}>
        <span className={css({ display: 'block', fontSize: 'sm', truncate: true })}>
          {game.name}
        </span>
        {/* Region and size on one mono line under the title: they are
            technical data, which is exactly what the mono face is reserved
            for, and stacking them frees the row's full width for the name.
            Compact mode keeps the old single-line shape. */}
        {mode !== 'compact' && (
          <span
            className={css({
              display: 'block',
              fontFamily: 'mono',
              fontSize: 'xs',
              color: 'fg.subtle',
              mt: '0.5',
              truncate: true,
            })}
          >
            {[game.region.join('/'), formatSize(totalSize(game))].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>

      {mode === 'compact' && (
        <>
          <span className={css({ display: 'flex', gap: '1', flexShrink: 0 })}>
            {game.region.map((r) => (
              <span
                key={r}
                className={css({
                  fontFamily: 'mono',
                  fontSize: 'xs',
                  px: '1.5',
                  py: '0.5',
                  bg: 'bg.muted',
                  color: 'fg.muted',
                  borderRadius: '6px',
                })}
              >
                {r}
              </span>
            ))}
          </span>

          <span
            className={css({
              fontFamily: 'mono',
              fontSize: 'xs',
              color: 'fg.faint',
              flexShrink: 0,
              w: '16',
              textAlign: 'right',
            })}
          >
            {formatSize(totalSize(game))}
          </span>
        </>
      )}
    </div>
  );
}
