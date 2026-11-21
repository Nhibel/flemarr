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
 * size everywhere it appears. Not sticky: it scrolls away with the page.
 * FontScaleControl is the only thing pinned to the viewport.
 *
 * Its right end is left empty on purpose: FontScaleControl sits in the
 * viewport's top-right corner and lands inside this strip at scroll 0.
 *
 * The logo links home. A real link to `homeHref` rather than a click
 * handler: routing lives in the URL hash, so following the href is the
 * navigation, and a middle click opens the home screen in a new tab.
 */
export function AppTopBar({ homeHref }: { homeHref: string }) {
  return (
    <header
      className={css({
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
        <a
          href={homeHref}
          aria-label="Flemarr — retour à Mes systèmes"
          title="Mes systèmes"
          className={css({ display: 'block', borderRadius: '8px' })}
        >
          <AppLogo height={40} />
        </a>
      </div>
    </header>
  );
}
