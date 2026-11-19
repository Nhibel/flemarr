import { css } from '@/styled-system/css';
import { Card } from '@/components/Card.js';
import { SystemIcon } from '@/components/SystemIcon.js';
import type { SystemIconStyle } from '@shared/system-icon.js';
import type { DatUploadResponse } from '@shared/api.js';
import { plural } from '@/lib/plural.js';

interface Props {
  dat: DatUploadResponse;
  iconStyle: SystemIconStyle | null | undefined;
  removing: boolean;
  onOpen: () => void;
  /** Removes the DAT, not the files on disk. */
  onRemove: () => void;
}

/** One registered system on the home screen: click to open it, ✕ to remove it. */
export function SystemCard({ dat, iconStyle, removing, onOpen, onRemove }: Props) {
  return (
    // The card recipe, not a hand-rolled surface: it carries the per-theme
    // shadows, Sonic Mania's and Cyberpunk's included.
    <Card
      className={css({
        position: 'relative',
        overflow: 'hidden',
        transition: 'background-color 0.15s',
        _hover: { bg: 'bg.muted' },
      })}
    >
      <button
        onClick={onOpen}
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '3',
          width: '100%',
          textAlign: 'left',
          px: '4',
          py: '4',
          pr: '10',
          bg: 'transparent',
          border: 'none',
          cursor: 'pointer',
        })}
      >
        <SystemIcon system={dat.system} style={iconStyle} size={56} />
        {/* The text is the row's one flexible child, so a long system name
            truncates instead of squeezing the icon. */}
        <span className={css({ flex: '1', minW: '0' })}>
          <span
            title={dat.system}
            className={css({
              display: 'block',
              fontFamily: 'display',
              fontSize: 'base',
              fontWeight: 'bold',
              color: 'fg.heading',
              truncate: true,
            })}
          >
            {dat.system}
          </span>
          <span
            className={css({
              display: 'block',
              mt: '1',
              fontFamily: 'mono',
              fontSize: '2xs',
              color: 'fg.dataFaint',
            })}
          >
            {dat.source} · {dat.gameCount} {plural(dat.gameCount, 'jeu', 'jeux')}
          </span>
        </span>
      </button>
      {/* Absolutely positioned, so it stays out of the card's own click
          target — the card is the common action and must not need aiming
          around a second button. */}
      <button
        onClick={onRemove}
        disabled={removing}
        title="Retirer ce système"
        aria-label={`Retirer ${dat.system}`}
        className={css({
          position: 'absolute',
          top: '2',
          right: '2',
          w: '28px',
          h: '28px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'transparent',
          border: 'none',
          borderRadius: '8px',
          fontSize: 'sm',
          color: 'fg.faint',
          cursor: 'pointer',
          _hover: { color: 'status.danger.text', bg: 'status.danger.subtle' },
          _disabled: { opacity: 0.5, cursor: 'not-allowed' },
        })}
      >
        ✕
      </button>
    </Card>
  );
}
