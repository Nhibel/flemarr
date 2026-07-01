import { css } from '@/styled-system/css';
import type { Game } from '@shared/dat.js';

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
  style: React.CSSProperties;
}

export function GameRow({ game, isSelected, isFocused, onToggle, style }: Props) {
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
        bg: isSelected ? 'blue.50' : isFocused ? 'bg.surface' : 'bg.page',
        outline: isFocused ? '2px solid token(colors.blue.500)' : 'none',
        outlineOffset: '-2px',
        cursor: 'pointer',
        userSelect: 'none',
        _hover: { bg: isSelected ? 'blue.100' : 'bg.surface' },
      })}
      onClick={() => onToggle(game.id)}
    >
      <input
        type="checkbox"
        checked={isSelected}
        aria-hidden
        tabIndex={-1}
        onChange={() => onToggle(game.id)}
        className={css({ flexShrink: 0, cursor: 'pointer' })}
      />

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
