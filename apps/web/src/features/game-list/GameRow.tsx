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
  // Boxart slot size; compact mode has no slot at all.
  const artSize = '10';
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
        px: '4',
        py: '2',
        borderBottom: '1px solid',
        borderColor: 'bd.subtle',
        bg: isSelected ? 'accent.subtle' : isFocused ? 'bg.surface' : 'bg.page',
        outline: isFocused ? '2px solid token(colors.accent.solid)' : 'none',
        outlineOffset: '-2px',
        cursor: 'pointer',
        userSelect: 'none',
        _hover: { bg: isSelected ? 'accent.subtle' : 'bg.surface' },
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
            className={css({
              w: artSize,
              h: artSize,
              objectFit: 'contain',
              flexShrink: 0,
              borderRadius: 'sm',
            })}
          />
        ) : (
          <span
            aria-hidden
            className={css({
              w: artSize,
              h: artSize,
              flexShrink: 0,
              borderRadius: 'sm',
              bg: 'bg.muted',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'fg.faint',
              fontSize: 'xs',
            })}
          >
            ?
          </span>
        ))}

      <span className={css({ flex: 1, fontSize: 'sm', truncate: true })}>{game.name}</span>

      <span className={css({ display: 'flex', gap: '1', flexShrink: 0 })}>
        {game.region.map((r) => (
          <span
            key={r}
            className={css({
              fontSize: 'xs',
              px: '1.5',
              py: '0.5',
              bg: 'bg.muted',
              color: 'fg.muted',
              borderRadius: 'sm',
            })}
          >
            {r}
          </span>
        ))}
      </span>

      <span
        className={css({
          fontSize: 'xs',
          color: 'fg.faint',
          flexShrink: 0,
          w: '16',
          textAlign: 'right',
        })}
      >
        {formatSize(totalSize(game))}
      </span>
    </div>
  );
}
