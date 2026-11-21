import { css } from '@/styled-system/css';
import { AppLogo } from './AppLogo.js';

/**
 * The strip's height, exported because the game view sizes itself to the
 * viewport and has to leave this much room above it.
 */
export const APP_TOP_BAR_HEIGHT = '72px';

/**
 * The strip reserved for the small logo at the top of every screen but the
 * home screen, which shows the logo large as its title instead. Mounted
 * once in App rather than per screen so the logo sits at the same place and
 * size everywhere it appears. Sticky, so scrolling a long page never takes
 * it away.
 *
 * Its right end is left empty on purpose: FontScaleControl is pinned to the
 * viewport's top-right corner and lands inside this strip.
 */
export function AppTopBar() {
  return (
    <header
      className={css({
        position: 'sticky',
        top: '0',
        // Under FontScaleControl (50), which overlaps the strip's right end.
        zIndex: '40',
        bg: 'bg.page',
        flexShrink: '0',
      })}
      style={{ height: APP_TOP_BAR_HEIGHT }}
    >
      <div
        className={css({
          maxW: '6xl',
          h: 'full',
          mx: 'auto',
          px: { base: '4', md: '6', lg: '8' },
          display: 'flex',
          alignItems: 'center',
        })}
      >
        <AppLogo height={40} />
      </div>
    </header>
  );
}
