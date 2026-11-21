import logoUrl from '@/assets/logo.svg';

// The drawing's own proportions, from the SVG's viewBox (2285×590).
const LOGO_ASPECT_RATIO = 2285 / 590;

/**
 * The app's wordmark: large as the home screen's title, small in the strip
 * the other screens reserve for it (AppTopBar).
 *
 * An <img>, not inlined markup: the SVG defines its gradient under a fixed
 * id (`_Linear1`), and inlining it in several places at once would put the
 * same id in the document more than once. As an image each copy keeps its
 * own document. Its colours are the logo's own and do not follow the theme.
 *
 * The size is set inline, not as `height`/`width` attributes: Panda's
 * preflight resets `img { height: auto }`, which beats an attribute, and the
 * SVG declares width/height 100% so it has no intrinsic size to fall back
 * on — with only an attribute the logo stretched to the full page width.
 *
 * The width is given and the height follows from `aspectRatio`, so that
 * `maxWidth: 100%` can shrink the whole logo on a screen narrower than it
 * (the home logo is 580px wide) instead of squashing or overflowing it.
 */
export function AppLogo({ height }: { height: number }) {
  const width = Math.round(height * LOGO_ASPECT_RATIO);
  return (
    <img
      src={logoUrl}
      alt="Flemarr"
      style={{
        display: 'block',
        width: `${width}px`,
        maxWidth: '100%',
        height: 'auto',
        aspectRatio: '2285 / 590',
      }}
    />
  );
}
