import { css } from '@/styled-system/css';
import type { SystemIconStyle } from '@shared/system-icon.js';
import { systemIconUrl } from '@/lib/asset-urls.js';

interface Props {
  system: string;
  /**
   * Which upstream set covers this system, from `useSystemIcons`.
   * `undefined` while the lookup is in flight, `null` when no icon exists.
   */
  style: SystemIconStyle | null | undefined;
  /**
   * Edge length in px. A literal px and not a spacing token, for the same
   * reason as the boxart slot in GameRow: this is a fixed image slot, and a
   * rem value would be rescaled by the live font-size control independently
   * of the picture inside it.
   */
  size: number;
}

/**
 * The system's machine, next to its name.
 *
 * Two upstream sets, drawn two ways. 'systematic' is a finished colour
 * illustration, so it is an <img> and keeps its own colours. 'monochrome' is
 * a white silhouette on transparent, which would be invisible on a light
 * theme, so it is used as a CSS mask over a token colour instead and follows
 * every theme. The mask URL is dynamic, so it goes in an inline style:
 * Panda extracts classes at build time and cannot see a runtime value.
 *
 * With no icon upstream — arcade boards, Video CD and the like — the slot
 * falls back to the title's initial on a filled square, the same placeholder
 * shape a game row shows for a missing boxart.
 */
export function SystemIcon({ system, style, size }: Props) {
  const box = { width: `${size}px`, height: `${size}px` };

  if (style === 'systematic') {
    return (
      <img
        src={systemIconUrl(system)}
        alt=""
        loading="lazy"
        style={box}
        className={css({
          objectFit: 'contain',
          flexShrink: 0,
          // The source is 256px and the slot is a fraction of that, so every
          // one of these is a large downscale and the thin outlines of the
          // drawings are the first thing to go. Chrome picks its better
          // filter for this; Firefox and Safari ignore the value and keep
          // their default, which is why the sizes above are the real fix and
          // this is only a hint.
          imageRendering: 'high-quality',
        })}
      />
    );
  }

  if (style === 'monochrome') {
    const url = `url("${systemIconUrl(system)}")`;
    return (
      <span
        aria-hidden
        style={{
          ...box,
          maskImage: url,
          WebkitMaskImage: url,
          maskSize: 'contain',
          WebkitMaskSize: 'contain',
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskPosition: 'center',
        }}
        className={css({ flexShrink: 0, bg: 'fg.muted' })}
      />
    );
  }

  return (
    <span
      aria-hidden
      style={{ ...box, fontSize: `${Math.round(size * 0.45)}px` }}
      className={css({
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px',
        bg: 'bg.slot',
        color: 'fg.faint',
        fontFamily: 'display',
        fontWeight: 'bold',
      })}
    >
      {system.slice(0, 1).toUpperCase()}
    </span>
  );
}
