import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'src/styled-system',
  // Seven self-contained themes selected via a single `data-theme` attribute
  // on <html> (apps/web/src/lib/use-theme.ts) — not a theme × light/dark
  // matrix. `dark` is redefined (on top of its built-in `.dark`-class
  // selector) so every theme resolves through the same mechanism; `base`
  // in semantic tokens below already IS the light theme, so no `light`
  // condition is needed. `matrix` is the original neon-green/yellow look
  // that used to be named `cyberpunk`, renamed once an actual
  // Cyberpunk-2077-styled (black/yellow/cyan) theme was added under that
  // name. That second theme is gone (2026-11-18); `matrix` keeps the name
  // it was given, since renaming it back would move everyone's stored
  // preference for nothing.
  //
  // This list and the condition keys used in semanticTokens below are the
  // only place a theme is declared, so adding one means adding a condition
  // here, a value under every token leaf, and an entry in both
  // apps/web/src/lib/use-theme.ts and the Apparence settings section. A
  // token leaf that is missing a theme's value silently falls back to
  // `base` — i.e. to the light theme — with no error, so a new theme's
  // value count must match the leaf count.
  conditions: {
    extend: {
      dark: '[data-theme="dark"] &',
      catppuccin: '[data-theme="catppuccin"] &',
      nightdrive: '[data-theme="nightdrive"] &',
      lemongrid: '[data-theme="lemongrid"] &',
      keppel: '[data-theme="keppel"] &',
      matrix: '[data-theme="matrix"] &',
      sonicmania: '[data-theme="sonicmania"] &',
      contraste: '[data-theme="contraste"] &',
    },
  },
  globalCss: {
    // Root font-size, not 16px (browser default). Every rem-based token —
    // fontSize, spacing (padding/gap), and the maxW container widths — scales
    // proportionally from this one value, app-wide, with zero per-component
    // changes. Was bumped to 22px, then brought back down to 18px, both
    // times by editing this literal and redeploying. Now backed by a CSS
    // variable instead (2026-11-13) so it can be adjusted live from Réglages
    // → Apparence (apps/web/src/lib/use-font-scale.ts) without a redeploy —
    // the `18px` fallback here is only for the instant before that hook
    // runs, and must stay equal to that file's DEFAULT_FONT_SCALE (two
    // independent constants, Panda config vs TS, not wired together).
    html: {
      fontSize: 'var(--font-scale, 18px)',
    },
    'html, body': {
      bg: 'bg.page',
      color: 'fg.default',
    },
    // Every heading in the app picks up the display face from here rather
    // than from ~20 individual component styles. Headings are the only
    // place this face is used; the mono face is the opposite — it is
    // applied per value, never globally, because it is meant for technical
    // data only (see the `fonts` tokens).
    'h1, h2, h3, h4': {
      fontFamily: 'display',
      letterSpacing: '-0.02em',
    },
    // bg.inset, not bg.page: a field is a recess inside whatever surface
    // holds it, and on bg.page it was the page tone drawn on top of the
    // page — invisible as a field.
    //
    // No border either, and a literal-px radius: the comps draw a field as
    // a filled recess, exactly like every other surface in this design.
    // Done globally because there were a dozen fields across the app each
    // carrying their own `1px solid bd.strong`.
    //
    // The focus ring is here too, for the same reason. These fields used to
    // show focus by recolouring their border; with no border left, several
    // of them were down to a one-theme glow and had no visible focus
    // at all in any of the others. One global rule cannot be forgotten
    // on the next field someone adds.
    'input, textarea, select': {
      bg: 'bg.inset',
      color: 'fg.default',
      border: 'none',
      borderRadius: '12px',
      _focusVisible: {
        outline: 'none',
        ring: '2px',
        ringColor: 'accent.subtleBorder',
      },
    },
    // The comps tint the native control rather than replacing it: 17px,
    // the theme's accent. accentColor is one property and the browser does
    // the rest, which keeps the checkbox a real checkbox — focusable,
    // announced, and keyboard-operable — instead of a styled div.
    //
    // A literal px size, like every other target in this redesign: a rem
    // value would be rescaled by the live font-size control.
    'input[type="checkbox"], input[type="radio"]': {
      accentColor: 'token(colors.accent.solid)',
      w: '17px',
      h: '17px',
      flexShrink: 0,
      cursor: 'pointer',
      borderRadius: '5px',
    },
  },
  theme: {
    extend: {
      tokens: {
        // Three roles, decided on the design canvas: Space Grotesk for
        // titles, Inter for body text, IBM Plex Mono reserved for technical
        // data (sizes, CRCs, counts, pagination). The point of the mono is
        // that metadata gets its own voice without the rest of the app
        // turning into a terminal — so it belongs on values, never on
        // labels or prose.
        //
        // All three are self-hosted through @fontsource* packages imported
        // in src/main.tsx, NOT a fonts.googleapis.com <link>: this app runs
        // on a homelab that may have no outbound internet, and a webfont
        // that fails to load would silently fall back to the system stack.
        // Each family's fallback chain still ends in a generic, so a
        // missing package degrades rather than breaks.
        // Panda's defaults are rem, which means every corner in the app
        // grew and shrank with the live font-size control
        // (src/lib/use-font-scale.ts) — at 24px a card rounded into a
        // lozenge, at 14px it squared off. A corner radius is not type.
        //
        // Overriding the scale in px fixes every existing
        // `borderRadius: 'lg'` at once and makes the rule impossible to
        // violate later, which is why this is here rather than as literal
        // px spread through the components. The values are the comps' own
        // ladder: 6/8/10 for controls, 14/16/18 for panels.
        // The whole ladder is overridden, including the steps nothing uses
        // yet: leaving any of them in rem is leaving a trap for whoever
        // reaches for it next. `full` is already 9999px and needs nothing.
        radii: {
          '2xs': { value: '3px' },
          xs: { value: '4px' },
          sm: { value: '6px' },
          md: { value: '8px' },
          lg: { value: '10px' },
          xl: { value: '14px' },
          '2xl': { value: '18px' },
          '3xl': { value: '24px' },
          '4xl': { value: '32px' },
        },
        fonts: {
          sans: {
            value:
              "'Inter Variable', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
          },
          display: {
            value:
              "'Space Grotesk Variable', 'Inter Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          },
          mono: {
            value:
              "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          },
        },
      },
      keyframes: {
        // Every theme: a sliding stripe for download progress when the
        // total size is unknown (archive.org's zip-view extraction streams
        // chunked, with no Content-Length) — a static bar frozen at 0%
        // read as stuck even while bytes were actually flowing.
        //
        // translateX() is a fraction of the bar's OWN width, not the
        // track's, so reaching the track's actual edges — not stopping
        // short of them — depends on the bar's width (25%, set where this
        // is used): -100% puts its right edge exactly at the track's left
        // edge (fully hidden, about to enter); 500% puts its left edge at
        // 125% of the track (fully hidden past the right edge). Both ends
        // sit off-track, so the infinite loop's snap back to 0% happens
        // while the bar is invisible — no visible jump.
        'indeterminate-slide': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(500%)' },
        },
      },
      semanticTokens: {
        colors: {
          // Nine self-contained themes. Every value here is taken from the
          // validated design comps in
          // .rom-curator-data/design-directions/project/*.dc.html — one
          // artboard per theme — rather than re-derived. Where a comp gives
          // a value for a role, that hex is used verbatim, including its
          // rgba washes, which composite over whatever surface they sit on
          // exactly as the comp does.
          //
          // The comps do not cover every token this app has: they show no
          // danger status, no info status, no second accent and no borders
          // at all (the shell replaced borders with shadows). Those roles
          // are marked `derived` below and are built only from hues the
          // same comp already uses, so no theme gains a colour its artboard
          // did not have.
          //
          // Mapping notes, where a comp's own structure needed a reading:
          //
          //   * bg.page is the artboard background, bg.surface the card the
          //     game list sits in, bg.muted the next tone in (search field,
          //     boxart slot, segmented track).
          //   * Several comps use only three greys where the fg.* ramp has
          //     five steps, so fg.heading/fg.default and fg.muted/fg.subtle
          //     share a value in those themes. That is the comp, not an
          //     omission.
          //   * Sonic Mania's dock is a dark teal card (#052A33) while every
          //     other surface in that artboard is light. There is no
          //     inverse-surface token in this system, so the dock renders on
          //     bg.surface like everywhere else. Representing it would need
          //     a new token, which is beyond a palette change.
          //   * Sonic Mania's comp disagrees with itself on the accent: its
          //     segmented control, tags and row selection are magenta
          //     (#E8215C) while its download button is gold (#F2A20C). The
          //     magenta family wins accent.* because the selection wash and
          //     accent text are both derived from it; the gold becomes
          //     accent2.
          //   * Contraste's comp assigns cyan to the owned status and pink
          //     to the warning, which leaves no third hue for info; info
          //     reuses the cyan. Both are non-alarming states, so sharing a
          //     hue costs less than inventing one.
          //   * Contraste and Matrix are the themes whose comp gives the
          //     page heading its own colour (the accent, with a glow)
          //     rather than the body text colour. Night Drive does the
          //     same, in cyan.
          //
          // Nintendo and Megadrive were removed (2026-11-15): navy plus a
          // saturated red read poorly down a long game list, and the two
          // themes were hard to tell apart from each other. Contraste
          // replaced them.
          //
          // Cyberpunk and Contraste were rebuilt together (2026-11-17),
          // from a third canvas:
          // https://claude.ai/artifact/CFC36ikYv4kaAnT6Ww9UKi
          //
          // They had converged into the same theme — a neutral near-black
          // page (#07080B against #0A0A0B) under a yellow-green accent
          // (#FDF500 against #C4F000) — and seven of the nine colours in
          // the Cyberpunk 2077 palette Camille supplied were unused,
          // starting with its own black, which is violet (Raisin Black
          // #272932), not neutral.
          //
          //   * CONTRASTE now carries, value for value, the palette that
          //     used to be Cyberpunk's: neutral black, Rich Lemon, cyan
          //     owned, pink warning. Nothing of it is new; it is the theme
          //     that was already there, under the name that fits it.
          //   * CYBERPUNK became the canvas's "Overdrive" artboard, on a
          //     saturated violet ground. It shipped, Camille lived with it,
          //     and it was dropped on 2026-11-18. Nothing of it remains.
          //
          // NIGHT DRIVE, LEMON GRID and KEPPEL replaced it (2026-11-18),
          // from a fourth canvas:
          // https://claude.ai/artifact/MYqQctFayQR4HjmmcgYemo
          //
          // Three arrangements of the SAME nine Cyberpunk 2077 colours, one
          // dominant each, chosen by Camille out of six proposals. What
          // Overdrive introduced and these three inherit: solid-fill status
          // tags (the `chip` tokens), a mono colour of their own (fg.data),
          // Blood Red #710000 as the danger surface.
          //
          //   * NIGHT DRIVE — Electric Blue runs the chrome: ground, page
          //     title, accent. Rich Lemon drops from the accent down to the
          //     technical values, so the yellow leaves the button and
          //     spreads through the list instead.
          //   * LEMON GRID — Rich Lemon stops being an accent and becomes a
          //     SURFACE: the Jeux header is a solid yellow band (see the
          //     bg.band group below), over a black warmed with the same
          //     hue. Data goes cyan.
          //   * KEPPEL — the quiet one. Teal ground and action, yellow kept
          //     for the title alone, and the only theme of the nine whose
          //     technical values are not coloured at all: fg.data is Pale
          //     Silver.
          //
          // The visible cost, accepted on the canvas rather than
          // overlooked: all three tint their filter chips by family (Région
          // and Catégorie) in GameFilters, which spends the info and
          // accent2 hues on something that is not a status and not the
          // primary action. It is the one place these themes break the
          // phase-14 rule that a vivid accent is reserved for the primary
          // action and the selection. Overdrive broke it alone; three
          // themes now do.
          //
          // Why each of the three spends info and accent2 where it does:
          // their accent takes one hue out of the nine, so the status roles
          // move around it. Night Drive's accent is the cyan, so its owned
          // status keeps the teal and info falls to Blushing Purple;
          // Keppel's accent IS the teal, so owned moves up to the cyan and
          // info again lands on the purple. Lemon Grid, whose accent is the
          // yellow, is the only one of the three that can leave both the
          // teal and the cyan where Overdrive had them.
          bg: {
            page: {
              value: {
                base: '#F3F1EC',
                _dark: '#12141A',
                _catppuccin: '#181825',
                _nightdrive: '#06121C',
                _lemongrid: '#14130A',
                _keppel: '#04191A',
                _matrix: '#040C07',
                _sonicmania: '#FFD522',
                _contraste: '#07080B',
              },
            },
            surface: {
              value: {
                base: '#FFFFFF',
                _dark: '#1B1F28',
                _catppuccin: '#1E1E2E',
                _nightdrive: '#0C2033',
                _lemongrid: '#1E1C10',
                _keppel: '#072628',
                _matrix: '#0B170F',
                _sonicmania: '#63D9EC',
                _contraste: '#11141A',
              },
            },
            muted: {
              value: {
                base: '#E7E4DC',
                _dark: '#232936',
                _catppuccin: '#313244',
                _nightdrive: '#133048',
                _lemongrid: '#2B2818',
                _keppel: '#0D3A3B',
                _matrix: '#16291C',
                _sonicmania: '#BFEFF7',
                _contraste: '#1E242D',
              },
            },
            // A recessed field sitting INSIDE a surface: the comps' search
            // input and icon buttons. Always a step deeper than
            // bg.surface, which is why it cannot just reuse bg.page — in
            // the light comp it is darker than the page, and in the dark
            // ones it sits between page and surface. Without it, an input
            // inside the header card fell back to bg.page and read as a
            // hole punched through the card.
            inset: {
              value: {
                base: '#F0EEE8',
                _dark: '#141821',
                _catppuccin: '#11111B',
                _nightdrive: '#040D16',
                _lemongrid: '#0D0C06',
                _keppel: '#020F10',
                _matrix: '#06100A',
                _sonicmania: '#BFEFF7',
                _contraste: '#0A0D12',
              },
            },
            // The action dock's surface. Identical to bg.surface in six of
            // the seven themes — it exists for Sonic Mania, whose artboard
            // makes the dock a dark teal card while every other surface in
            // it is light, so the primary action reads as the one heavy
            // thing on a very bright page.
            //
            // A token rather than a `_sonicmania` override in App.tsx
            // because the text on it has to flip with it: see
            // fg.onInverse below. One theme needing an inverse surface is
            // still a role, not a special case.
            inverse: {
              value: {
                base: '#FFFFFF',
                _dark: '#1B1F28',
                _catppuccin: '#1E1E2E',
                _nightdrive: '#0C2033',
                _lemongrid: '#1E1C10',
                _keppel: '#072628',
                _matrix: '#0B170F',
                _sonicmania: '#052A33',
                _contraste: '#11141A',
              },
            },
            // The boxart placeholder slot. Mostly a step lighter than
            // bg.muted, but Sonic Mania's comp fills it with the page's
            // own gold and Contraste's with a lighter grey than its muted
            // tone, so it cannot be derived from either.
            slot: {
              value: {
                base: '#E7E4DC',
                _dark: '#2A3040',
                _catppuccin: '#313244',
                _nightdrive: '#1A4260',
                _lemongrid: '#3A3620',
                _keppel: '#11504F',
                _matrix: '#16291C',
                _sonicmania: '#FFD522',
                _contraste: '#1E242D',
              },
            },
            // The Jeux header's surface. Identical to bg.surface in eight
            // of the nine themes — it exists for Lemon Grid, whose canvas
            // makes that one header a solid Rich Lemon band while every
            // other surface in it stays a warmed black.
            //
            // A token rather than a `_lemongrid` override in App.tsx for
            // the same reason bg.inverse is one: everything written on it
            // has to flip with it (fg.onBand* below), and a colour written
            // into a .tsx is invisible to theme-contrast.test.ts, which
            // reads this file. One theme needing a coloured header is
            // still a role, not a special case.
            //
            // It covers the Jeux header only. The home screen, the folder
            // bar and Réglages keep bg.surface in Lemon Grid, so the band
            // marks the console you have open and nothing else.
            band: {
              value: {
                base: '#FFFFFF',
                _dark: '#1B1F28',
                _catppuccin: '#1E1E2E',
                _nightdrive: '#0C2033',
                _lemongrid: '#FDF500',
                _keppel: '#072628',
                _matrix: '#0B170F',
                _sonicmania: '#63D9EC',
                _contraste: '#11141A',
              },
            },
          },
          // All derived: the comps draw no borders anywhere. Each step is
          // the comp's own next tone up from bg.muted, so a divider inside
          // a card still belongs to its theme.
          bd: {
            subtle: {
              value: {
                base: '#EFEDE7',
                _dark: '#232936',
                _catppuccin: '#313244',
                _nightdrive: '#0F2A40',
                _lemongrid: '#262314',
                _keppel: '#0A3031',
                _matrix: '#142419',
                _sonicmania: '#8FD3E0',
                _contraste: '#1A1F27',
              },
            },
            default: {
              value: {
                base: '#E7E4DC',
                _dark: '#2A3040',
                _catppuccin: '#45475A',
                _nightdrive: '#133048',
                _lemongrid: '#2B2818',
                _keppel: '#0D3A3B',
                _matrix: '#16291C',
                _sonicmania: '#19A9C4',
                _contraste: '#1E242D',
              },
            },
            strong: {
              value: {
                base: '#CFCABE',
                _dark: '#3A4356',
                _catppuccin: '#585B70',
                _nightdrive: '#1F4A6B',
                _lemongrid: '#46422A',
                _keppel: '#175A58',
                _matrix: '#2E5438',
                _sonicmania: '#0B4D5C',
                _contraste: '#2A323D',
              },
            },
          },
          fg: {
            heading: {
              value: {
                base: '#17171A',
                _dark: '#ECEEF4',
                _catppuccin: '#CDD6F4',
                // The two comps that give the page title its own colour:
                // the accent, carrying a glow (applied in the components).
                _nightdrive: '#37EBF3',
                _lemongrid: '#FDF500',
                _keppel: '#FDF500',
                _matrix: '#43F57B',
                _sonicmania: '#052A33',
                _contraste: '#FDF500',
              },
            },
            default: {
              value: {
                base: '#17171A',
                _dark: '#ECEEF4',
                _catppuccin: '#CDD6F4',
                _nightdrive: '#E8F4F8',
                _lemongrid: '#E9E2D8',
                _keppel: '#E6F5F2',
                _matrix: '#D7F5E0',
                _sonicmania: '#0A2229',
                _contraste: '#EDF2F4',
              },
            },
            muted: {
              value: {
                base: '#4A4843',
                _dark: '#99A1B3',
                _catppuccin: '#A6ADC8',
                _nightdrive: '#8FB8CC',
                _lemongrid: '#C4BE9E',
                _keppel: '#8FC5BE',
                _matrix: '#7FAE8E',
                _sonicmania: '#0B4D5C',
                _contraste: '#93A4AD',
              },
            },
            subtle: {
              value: {
                base: '#5E5C55',
                _dark: '#99A1B3',
                _catppuccin: '#A6ADC8',
                _nightdrive: '#8FB8CC',
                _lemongrid: '#C4BE9E',
                _keppel: '#8FC5BE',
                _matrix: '#7FAE8E',
                _sonicmania: '#0B4D5C',
                _contraste: '#93A4AD',
              },
            },
            faint: {
              value: {
                base: '#8C887E',
                _dark: '#717A91',
                _catppuccin: '#7F849C',
                _nightdrive: '#6E9AB2',
                _lemongrid: '#948F72',
                _keppel: '#5F9A93',
                _matrix: '#5C8A6B',
                _sonicmania: '#6B5300',
                _contraste: '#6B7C86',
              },
            },
            // Text on bg.inverse. Same as fg.default wherever bg.inverse is
            // just bg.surface; Sonic Mania is the one theme where the two
            // diverge, and it has to, because its dock is dark while its
            // body text is near-black.
            onInverse: {
              value: {
                base: '#17171A',
                _dark: '#ECEEF4',
                _catppuccin: '#CDD6F4',
                _nightdrive: '#E8F4F8',
                _lemongrid: '#E9E2D8',
                _keppel: '#E6F5F2',
                _matrix: '#D7F5E0',
                _sonicmania: '#E6FAFF',
                _contraste: '#EDF2F4',
              },
            },
            // The quieter half of the dock's text — the size, in mono.
            onInverseMuted: {
              value: {
                base: '#5E5C55',
                _dark: '#99A1B3',
                _catppuccin: '#A6ADC8',
                _nightdrive: '#8FB8CC',
                _lemongrid: '#C4BE9E',
                _keppel: '#8FC5BE',
                _matrix: '#7FAE8E',
                _sonicmania: '#8FD3E0',
                _contraste: '#93A4AD',
              },
            },
            // Technical values set in the mono face — file sizes, CRCs,
            // counts, pagination, "1401 / 1401". Six of the nine themes
            // define these as exactly their own fg.subtle / fg.faint, so
            // nothing moves in them; the pair exists because the three
            // palettes drawn from the Cyberpunk 2077 colours each give
            // their data a colour of its own — yellow in Night Drive, cyan
            // in Lemon Grid, Pale Silver in Keppel — so a technical value
            // reads as a HUD readout rather than as dimmer body text.
            //
            // Two steps rather than one so those six themes keep the
            // contrast they already had: a mono value that was fg.subtle
            // becomes fg.data, one that was fg.faint becomes fg.dataFaint.
            // Collapsing them would have dimmed a dozen labels in every
            // other theme to buy three themes their own mono colour.
            //
            // Not for mono text that already sits in a coloured context —
            // the dock (fg.onInverseMuted), a source id in accent.text, a
            // Chip's own count — which keeps its container's colour.
            data: {
              value: {
                base: '#5E5C55',
                _dark: '#99A1B3',
                _catppuccin: '#A6ADC8',
                _nightdrive: '#FDF500',
                _lemongrid: '#37EBF3',
                _keppel: '#D1C5C0',
                _matrix: '#7FAE8E',
                _sonicmania: '#0B4D5C',
                _contraste: '#93A4AD',
              },
            },
            dataFaint: {
              value: {
                base: '#8C887E',
                _dark: '#717A91',
                _catppuccin: '#7F849C',
                _nightdrive: '#C9C200',
                _lemongrid: '#37EBF3',
                _keppel: '#A89C97',
                _matrix: '#5C8A6B',
                _sonicmania: '#6B5300',
                _contraste: '#6B7C86',
              },
            },
            // The three things written on bg.band: the console's name, the
            // ownership counter beside it, and the owned half of that
            // counter. Each is its ordinary token (fg.heading, fg.dataFaint,
            // status.success.text) in eight themes, character for
            // character, and only Lemon Grid moves — where the band is
            // yellow, every one of them would otherwise fail: the teal of
            // the owned count measures 1.89:1 on Rich Lemon.
            //
            // Keep each in step with the token it mirrors.
            onBand: {
              value: {
                base: '#17171A',
                _dark: '#ECEEF4',
                _catppuccin: '#CDD6F4',
                _nightdrive: '#37EBF3',
                _lemongrid: '#14130A',
                _keppel: '#FDF500',
                _matrix: '#43F57B',
                _sonicmania: '#052A33',
                _contraste: '#FDF500',
              },
            },
            onBandMuted: {
              value: {
                base: '#8C887E',
                _dark: '#717A91',
                _catppuccin: '#7F849C',
                _nightdrive: '#C9C200',
                _lemongrid: '#4A4607',
                _keppel: '#A89C97',
                _matrix: '#5C8A6B',
                _sonicmania: '#6B5300',
                _contraste: '#6B7C86',
              },
            },
            onBandSuccess: {
              value: {
                base: '#0E6B46',
                _dark: '#35D4A4',
                _catppuccin: '#A6E3A1',
                _nightdrive: '#2BE0C8',
                _lemongrid: '#064F45',
                _keppel: '#37EBF3',
                _matrix: '#43F57B',
                _sonicmania: '#063B2A',
                _contraste: '#37EBF3',
              },
            },
          },
          // The primary action colour: the comps' download button, their
          // active segmented tab and their row selection all read from
          // here. `fg` is the text colour used ON TOP of `solid`, taken
          // from the comp's own button.
          accent: {
            solid: {
              value: {
                base: '#2F5BD9',
                _dark: '#6C8FFF',
                _catppuccin: '#CBA6F7',
                _nightdrive: '#37EBF3',
                _lemongrid: '#FDF500',
                _keppel: '#1AC5B0',
                _matrix: '#43F57B',
                _sonicmania: '#E01B55',
                _contraste: '#FDF500',
              },
            },
            // Derived except where a comp showed a second step of its
            // accent: one notch toward the page in the light themes, one
            // notch away from it in the dark ones.
            hover: {
              value: {
                base: '#244AB5',
                _dark: '#93AEFF',
                _catppuccin: '#DDBFFA',
                _nightdrive: '#7BF4F9',
                _lemongrid: '#D6CF00',
                _keppel: '#4FDCC9',
                _matrix: '#7CFAA5',
                _sonicmania: '#C4134A',
                _contraste: '#D6CF00',
              },
            },
            // The comps' row-selection wash. Kept as the comp's own rgba
            // where it used one, so it composites over the list card
            // exactly as the artboard does.
            subtle: {
              value: {
                base: '#E8EEFD',
                _dark: 'rgba(108, 143, 255, 0.13)',
                _catppuccin: 'rgba(203, 166, 247, 0.14)',
                _nightdrive: 'rgba(55, 235, 243, 0.16)',
                _lemongrid: 'rgba(253, 245, 0, 0.13)',
                _keppel: 'rgba(26, 197, 176, 0.17)',
                _matrix: 'rgba(67, 245, 123, 0.1)',
                _sonicmania: '#FFD9E4',
                _contraste: 'rgba(253, 245, 0, 0.1)',
              },
            },
            // Derived: the same wash at a strength that reads as an edge.
            subtleBorder: {
              value: {
                base: '#BBCCF7',
                _dark: 'rgba(108, 143, 255, 0.45)',
                _catppuccin: 'rgba(203, 166, 247, 0.45)',
                _nightdrive: 'rgba(55, 235, 243, 0.45)',
                _lemongrid: 'rgba(253, 245, 0, 0.45)',
                _keppel: 'rgba(26, 197, 176, 0.5)',
                _matrix: 'rgba(67, 245, 123, 0.4)',
                _sonicmania: '#F5A8C0',
                _contraste: 'rgba(253, 245, 0, 0.4)',
              },
            },
            text: {
              value: {
                base: '#244AB5',
                _dark: '#93AEFF',
                _catppuccin: '#CBA6F7',
                _nightdrive: '#37EBF3',
                _lemongrid: '#FDF500',
                _keppel: '#2BE0C8',
                _matrix: '#43F57B',
                _sonicmania: '#7A2238',
                _contraste: '#FDF500',
              },
            },
            fg: {
              value: {
                base: '#FFFFFF',
                _dark: '#0B0E16',
                _catppuccin: '#1E1E2E',
                _nightdrive: '#06121C',
                _lemongrid: '#14130A',
                _keppel: '#04191A',
                _matrix: '#04120A',
                _sonicmania: '#FFFFFF',
                _contraste: '#07080B',
              },
            },
          },
          // Status colours for the tinted tags (Chip, LayoutBadge,
          // DownloadManager status dots...). success and warning come
          // straight from each comp's "Sur ton disque" and "Mal nommé"
          // tags, washes included. danger and info are derived: no comp
          // shows either, so each is built from a hue its own artboard
          // already uses.
          status: {
            success: {
              subtle: {
                value: {
                  base: '#D8F0E4',
                  _dark: 'rgba(53, 212, 164, 0.14)',
                  _catppuccin: 'rgba(166, 227, 161, 0.15)',
                  _nightdrive: 'rgba(26, 197, 176, 0.18)',
                  _lemongrid: 'rgba(26, 197, 176, 0.18)',
                  _keppel: 'rgba(55, 235, 243, 0.16)',
                  _matrix: 'rgba(67, 245, 123, 0.14)',
                  _sonicmania: '#8FE8C2',
                  _contraste: 'rgba(55, 235, 243, 0.13)',
                },
              },
              subtleBorder: {
                value: {
                  base: '#A8DCC4',
                  _dark: 'rgba(53, 212, 164, 0.45)',
                  _catppuccin: 'rgba(166, 227, 161, 0.45)',
                  _nightdrive: 'rgba(26, 197, 176, 0.5)',
                  _lemongrid: 'rgba(26, 197, 176, 0.5)',
                  _keppel: 'rgba(55, 235, 243, 0.5)',
                  _matrix: 'rgba(67, 245, 123, 0.45)',
                  _sonicmania: '#4FBF8F',
                  _contraste: 'rgba(55, 235, 243, 0.45)',
                },
              },
              text: {
                value: {
                  base: '#0E6B46',
                  _dark: '#35D4A4',
                  _catppuccin: '#A6E3A1',
                  // The Keppel teal, which is what the owned status is in
                  // the palette these three share — except in the Keppel
                  // theme itself, where that teal is already the accent,
                  // so owned moves up to the Electric Blue. Contraste
                  // inherited the same cyan from the theme it replaced.
                  _nightdrive: '#2BE0C8',
                  _lemongrid: '#2BE0C8',
                  _keppel: '#37EBF3',
                  _matrix: '#43F57B',
                  _sonicmania: '#063B2A',
                  _contraste: '#37EBF3',
                },
              },
            },
            // All derived. Each is the comp's palette pushed to a red that
            // is not already taken by that theme's accent or warning.
            danger: {
              subtle: {
                value: {
                  base: '#FBE4E2',
                  _dark: 'rgba(255, 128, 128, 0.14)',
                  _catppuccin: 'rgba(243, 139, 168, 0.15)',
                  // The one solid value in a field of washes: Blood Red
                  // #710000 from the Coolors palette, which the canvas
                  // fills the error panel and the "Introuvable" tag with
                  // in all three of these themes. A 14 % wash of it over
                  // their dark grounds would have been invisible.
                  _nightdrive: '#710000',
                  _lemongrid: '#710000',
                  _keppel: '#710000',
                  _matrix: 'rgba(255, 92, 92, 0.14)',
                  _sonicmania: '#FFD2D6',
                  _contraste: 'rgba(255, 61, 61, 0.14)',
                },
              },
              subtleBorder: {
                value: {
                  base: '#F0BEB9',
                  _dark: 'rgba(255, 128, 128, 0.45)',
                  _catppuccin: 'rgba(243, 139, 168, 0.45)',
                  _nightdrive: 'rgba(255, 138, 122, 0.5)',
                  _lemongrid: 'rgba(255, 138, 122, 0.5)',
                  _keppel: 'rgba(255, 138, 122, 0.5)',
                  _matrix: 'rgba(255, 92, 92, 0.45)',
                  _sonicmania: '#F09AA2',
                  _contraste: 'rgba(255, 61, 61, 0.5)',
                },
              },
              text: {
                value: {
                  base: '#B3261E',
                  _dark: '#FF8080',
                  _catppuccin: '#F38BA8',
                  _nightdrive: '#FF8A7A',
                  _lemongrid: '#FF8A7A',
                  _keppel: '#FF8A7A',
                  _matrix: '#FF5C5C',
                  _sonicmania: '#8C1220',
                  _contraste: '#FF3D3D',
                },
              },
            },
            warning: {
              subtle: {
                value: {
                  base: '#FBE6CC',
                  _dark: 'rgba(255, 180, 84, 0.14)',
                  _catppuccin: 'rgba(250, 179, 135, 0.15)',
                  _nightdrive: 'rgba(228, 85, 174, 0.18)',
                  _lemongrid: 'rgba(228, 85, 174, 0.18)',
                  _keppel: 'rgba(228, 85, 174, 0.18)',
                  _matrix: 'rgba(245, 197, 66, 0.14)',
                  _sonicmania: '#FFCE8A',
                  _contraste: 'rgba(255, 77, 157, 0.14)',
                },
              },
              subtleBorder: {
                value: {
                  base: '#F0CFA0',
                  _dark: 'rgba(255, 180, 84, 0.45)',
                  _catppuccin: 'rgba(250, 179, 135, 0.45)',
                  _nightdrive: 'rgba(228, 85, 174, 0.5)',
                  _lemongrid: 'rgba(228, 85, 174, 0.5)',
                  _keppel: 'rgba(228, 85, 174, 0.5)',
                  _matrix: 'rgba(245, 197, 66, 0.45)',
                  _sonicmania: '#D69B47',
                  _contraste: 'rgba(255, 77, 157, 0.45)',
                },
              },
              text: {
                value: {
                  base: '#8A4600',
                  _dark: '#FFB454',
                  _catppuccin: '#FAB387',
                  // Pink, per the comps: warning is the Frostbite #E455AE
                  // of the shared palette, and in Contraste the yellow is
                  // the accent already, so nothing here is orange.
                  //
                  // The text step is lighter than the fill because #E455AE
                  // as text on its own 18 % wash measured 3.92:1 on a dark
                  // ground. #E455AE stays where the comps actually put it:
                  // `solid` and `chip.warning.bg`.
                  _nightdrive: '#F285C6',
                  _lemongrid: '#F285C6',
                  _keppel: '#F285C6',
                  _matrix: '#F5C542',
                  _sonicmania: '#613100',
                  _contraste: '#FF4D9D',
                },
              },
              // The only status role with a *solid* usage (ScanPage's
              // "Renommer N fichiers" CTA) — success/danger/info never
              // appear as a filled button, so they don't need this shape.
              // Derived: the role's text colour, at a strength that can
              // carry `fg` on top.
              solid: {
                value: {
                  base: '#D98A00',
                  _dark: '#E8963A',
                  _catppuccin: '#FAB387',
                  _nightdrive: '#E455AE',
                  _lemongrid: '#E455AE',
                  _keppel: '#E455AE',
                  _matrix: '#F5C542',
                  _sonicmania: '#D69B47',
                  _contraste: '#FF4D9D',
                },
              },
              hover: {
                value: {
                  base: '#B87400',
                  _dark: '#FFB454',
                  _catppuccin: '#F8C9A8',
                  _nightdrive: '#F285C6',
                  _lemongrid: '#F285C6',
                  _keppel: '#F285C6',
                  _matrix: '#FFD966',
                  _sonicmania: '#B87F2E',
                  _contraste: '#FF75B4',
                },
              },
              fg: {
                value: {
                  // Dark, not white: white on this amber measures 2.77:1,
                  // which fails the 4.5:1 the palette rules promise. Every
                  // other theme already carries dark text here for the
                  // same reason — the light theme was the one that did
                  // not, because its `solid` is the only amber dark enough
                  // that white looked plausible without being legible.
                  base: '#2B1400',
                  _dark: '#15100A',
                  _catppuccin: '#1E1E2E',
                  _nightdrive: '#2E0620',
                  _lemongrid: '#2E0620',
                  _keppel: '#2E0620',
                  _matrix: '#0F0C02',
                  _sonicmania: '#2B1A00',
                  _contraste: '#2B0618',
                },
              },
            },
            // All derived. Contraste shares its cyan with success, since
            // the comp it inherited spends its three hues on accent, owned
            // and warning and leaves none over; both are non-alarming
            // states. The three Cyberpunk-palette themes do not have to
            // share: Lemon Grid, whose accent is the yellow, keeps the
            // Electric Blue free for info, and Night Drive and Keppel —
            // whose accents take the cyan and the teal — reach instead for
            // Blushing Purple, the one hue neither their accent nor their
            // warning has claimed.
            info: {
              subtle: {
                value: {
                  base: '#E8EEFD',
                  _dark: 'rgba(108, 143, 255, 0.13)',
                  _catppuccin: 'rgba(137, 180, 250, 0.15)',
                  _nightdrive: 'rgba(147, 112, 219, 0.22)',
                  _lemongrid: 'rgba(55, 235, 243, 0.16)',
                  _keppel: 'rgba(147, 112, 219, 0.22)',
                  _matrix: 'rgba(57, 249, 255, 0.13)',
                  _sonicmania: '#E6FAFF',
                  _contraste: 'rgba(55, 235, 243, 0.13)',
                },
              },
              subtleBorder: {
                value: {
                  base: '#B9D3F0',
                  _dark: 'rgba(108, 143, 255, 0.45)',
                  _catppuccin: 'rgba(137, 180, 250, 0.45)',
                  _nightdrive: 'rgba(147, 112, 219, 0.5)',
                  _lemongrid: 'rgba(55, 235, 243, 0.5)',
                  _keppel: 'rgba(147, 112, 219, 0.5)',
                  _matrix: 'rgba(57, 249, 255, 0.45)',
                  _sonicmania: '#8FD3E0',
                  _contraste: 'rgba(55, 235, 243, 0.45)',
                },
              },
              text: {
                value: {
                  base: '#244AB5',
                  _dark: '#93AEFF',
                  _catppuccin: '#89B4FA',
                  _nightdrive: '#B88BFF',
                  _lemongrid: '#37EBF3',
                  _keppel: '#B88BFF',
                  _matrix: '#39F9FF',
                  _sonicmania: '#0E6B7E',
                  _contraste: '#37EBF3',
                },
              },
            },
          },
          // A second, distinct accent for the "suggested by the app"
          // actions (SourcesManager's suggest button, its adopt button in
          // SuggestionRow) and the Category filter chips — kept visually
          // separate from the primary accent on purpose.
          //
          // Derived in every theme but two: no comp shows this role.
          // Sonic Mania's is the gold its comp used on the download button
          // (the magenta family took accent.*), and Matrix's is its comp's
          // own warning gold, which is the only second hue that artboard
          // has. Night Drive and Keppel take Steel Pink from the Coolors
          // palette, two steps lighter than the #CB1DCD the strip gives —
          // that hex carries dark text at 4.18:1, which fails. Lemon Grid
          // uses Blushing Purple here, because its info role already holds
          // the cyan and a second magenta beside its Frostbite warning
          // would read as the same tag twice.
          accent2: {
            solid: {
              value: {
                base: '#6D44C8',
                _dark: '#A78BFA',
                _catppuccin: '#F5C2E7',
                _nightdrive: '#E86FE9',
                _lemongrid: '#B88BFF',
                _keppel: '#E86FE9',
                _matrix: '#F5C542',
                _sonicmania: '#F2A20C',
                _contraste: '#CB1DCD',
              },
            },
            hover: {
              value: {
                base: '#5835A8',
                _dark: '#BFA6FC',
                _catppuccin: '#F8D4EE',
                _nightdrive: '#F3A9F4',
                _lemongrid: '#D0B4FF',
                _keppel: '#F3A9F4',
                _matrix: '#FFD966',
                _sonicmania: '#D68B00',
                _contraste: '#E455AE',
              },
            },
            subtleBorder: {
              value: {
                base: '#D5C8F2',
                _dark: 'rgba(167, 139, 250, 0.45)',
                _catppuccin: 'rgba(245, 194, 231, 0.45)',
                _nightdrive: 'rgba(203, 29, 205, 0.5)',
                _lemongrid: 'rgba(147, 112, 219, 0.5)',
                _keppel: 'rgba(203, 29, 205, 0.5)',
                _matrix: 'rgba(245, 197, 66, 0.45)',
                _sonicmania: '#6B5300',
                _contraste: 'rgba(203, 29, 205, 0.5)',
              },
            },
            // The wash-and-text pair, mirroring accent.subtle /
            // accent.text. Only the three Cyberpunk-palette themes read
            // them (their Catégorie filter trigger), but every theme
            // carries a value: a token leaf that skips a theme falls back
            // to `base` with no error, which would put a light lavender
            // wash on a dark page the day another theme reaches for it.
            subtle: {
              value: {
                base: '#EDE7FA',
                _dark: 'rgba(167, 139, 250, 0.14)',
                _catppuccin: 'rgba(245, 194, 231, 0.15)',
                _nightdrive: 'rgba(203, 29, 205, 0.22)',
                _lemongrid: 'rgba(147, 112, 219, 0.22)',
                _keppel: 'rgba(203, 29, 205, 0.22)',
                _matrix: 'rgba(245, 197, 66, 0.14)',
                _sonicmania: '#FFE9BF',
                _contraste: 'rgba(203, 29, 205, 0.18)',
              },
            },
            text: {
              value: {
                base: '#5835A8',
                _dark: '#A78BFA',
                _catppuccin: '#F5C2E7',
                _nightdrive: '#E86FE9',
                _lemongrid: '#B88BFF',
                _keppel: '#E86FE9',
                _matrix: '#F5C542',
                _sonicmania: '#6B5300',
                _contraste: '#E455AE',
              },
            },
            fg: {
              value: {
                base: '#FFFFFF',
                _dark: '#0B0E16',
                _catppuccin: '#1E1E2E',
                _nightdrive: '#06121C',
                _lemongrid: '#14130A',
                _keppel: '#04191A',
                _matrix: '#0F0C02',
                _sonicmania: '#2B1A00',
                _contraste: '#FFFFFF',
              },
            },
          },
          // The fill and the text of a status TAG (Chip, StatusTag), as
          // opposed to the same status spoken as plain prose, which keeps
          // using status.*.text on whatever surface it sits on.
          //
          // The two were one pair of tokens until the Cyberpunk-palette
          // comps drew their tags as solid fills with dark text while every
          // other theme draws them as a tinted wash with the status colour
          // as text. Reusing status.*.subtle / status.*.text for both would
          // have forced a choice: either those tags stay washes, or the
          // ~30 plain-text status messages turn dark-on-dark. So the tag
          // gets its own pair.
          //
          // In the six wash themes these are character-for-character the
          // status.*.subtle / status.*.text values. Only Night Drive,
          // Lemon Grid and Keppel differ. Keep them in step when a status
          // colour changes.
          //
          // The neutral third role (Chip's `gray`, StatusTag's `missing`)
          // is not here: it is bg.muted + fg.muted/fg.subtle in every
          // theme, those three included, because a quiet tag repeated
          // across 1500 unscanned rows must stay quiet.
          chip: {
            success: {
              bg: {
                value: {
                  base: '#D8F0E4',
                  _dark: 'rgba(53, 212, 164, 0.14)',
                  _catppuccin: 'rgba(166, 227, 161, 0.15)',
                  _nightdrive: '#1AC5B0',
                  _lemongrid: '#1AC5B0',
                  _keppel: '#37EBF3',
                  _matrix: 'rgba(67, 245, 123, 0.14)',
                  _sonicmania: '#8FE8C2',
                  _contraste: 'rgba(55, 235, 243, 0.13)',
                },
              },
              fg: {
                value: {
                  base: '#0E6B46',
                  _dark: '#35D4A4',
                  _catppuccin: '#A6E3A1',
                  _nightdrive: '#04231F',
                  _lemongrid: '#04231F',
                  _keppel: '#04282B',
                  _matrix: '#43F57B',
                  _sonicmania: '#063B2A',
                  _contraste: '#37EBF3',
                },
              },
            },
            warning: {
              bg: {
                value: {
                  base: '#FBE6CC',
                  _dark: 'rgba(255, 180, 84, 0.14)',
                  _catppuccin: 'rgba(250, 179, 135, 0.15)',
                  _nightdrive: '#E455AE',
                  _lemongrid: '#E455AE',
                  _keppel: '#E455AE',
                  _matrix: 'rgba(245, 197, 66, 0.14)',
                  _sonicmania: '#FFCE8A',
                  _contraste: 'rgba(255, 77, 157, 0.14)',
                },
              },
              fg: {
                value: {
                  base: '#8A4600',
                  _dark: '#FFB454',
                  _catppuccin: '#FAB387',
                  _nightdrive: '#2E0620',
                  _lemongrid: '#2E0620',
                  _keppel: '#2E0620',
                  _matrix: '#F5C542',
                  _sonicmania: '#613100',
                  _contraste: '#FF4D9D',
                },
              },
            },
            // LayoutBadge's "zip" half, and the comp's "En attente" tag.
            // There is no chip.danger: in those three themes
            // status.danger.subtle is already the solid Blood Red the
            // comps fill that tag with, so
            // a danger tag built from status.* lands on the right shape in
            // every theme without a second pair.
            info: {
              bg: {
                value: {
                  base: '#E8EEFD',
                  _dark: 'rgba(108, 143, 255, 0.13)',
                  _catppuccin: 'rgba(137, 180, 250, 0.15)',
                  _nightdrive: '#B88BFF',
                  _lemongrid: '#37EBF3',
                  _keppel: '#B88BFF',
                  _matrix: 'rgba(57, 249, 255, 0.13)',
                  _sonicmania: '#E6FAFF',
                  _contraste: 'rgba(55, 235, 243, 0.13)',
                },
              },
              fg: {
                value: {
                  base: '#244AB5',
                  _dark: '#93AEFF',
                  _catppuccin: '#89B4FA',
                  _nightdrive: '#0E0620',
                  _lemongrid: '#04282B',
                  _keppel: '#0E0620',
                  _matrix: '#39F9FF',
                  _sonicmania: '#0E6B7E',
                  _contraste: '#37EBF3',
                },
              },
            },
          },
        },
      },
      recipes: {
        button: {
          className: 'button',
          base: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2',
            fontWeight: 'semibold',
            // Literal px, not the `lg` token — a rem radius would grow with
            // the live font-size control and round a button into a pill.
            borderRadius: '12px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background-color 0.15s, border-color 0.15s, box-shadow 0.15s',
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          },
          variants: {
            variant: {
              // Two themes' comps put a glow behind this button, and it is
              // a *static* one at the exact strengths below — not the
              // breathing animation that used to be here, which was my
              // invention and which neither artboard shows.
              primary: {
                bg: 'accent.solid',
                color: 'accent.fg',
                shadow: 'sm',
                _hover: { bg: 'accent.hover' },
                _nightdrive: { boxShadow: '0 0 26px rgba(55, 235, 243, 0.5)' },
                _matrix: { boxShadow: '0 0 18px rgba(67, 245, 123, 0.35)' },
                _contraste: { boxShadow: '0 0 18px rgba(253, 245, 0, 0.4)' },
              },
              // A filled tone rather than an outline, for the same reason
              // the card lost its border: a screen full of 1px-outlined
              // buttons reads as a wireframe. A cyan outline and a magenta
              // hover glow used to sit here for one theme; they were mine,
              // and no comp has ever drawn this button as anything but a
              // plain filled tone.
              secondary: {
                bg: 'bg.muted',
                color: 'fg.default',
                _hover: { bg: 'bg.surface' },
              },
              // Danger keeps its outline: it is the one variant where the
              // border carries meaning rather than structure, and a filled
              // red would read as the primary action.
              danger: {
                bg: 'bg.surface',
                color: 'status.danger.text',
                border: '1px solid',
                borderColor: 'status.danger.subtleBorder',
                _hover: { bg: 'status.danger.subtle' },
              },
              ghost: {
                bg: 'transparent',
                color: 'fg.muted',
                _hover: { bg: 'bg.surface', color: 'fg.default' },
              },
            },
            // minH in literal px, like the radius: these are touch targets
            // (the app is used on a Steam Deck), so they must not shrink
            // when the live font-size control is turned down.
            size: {
              sm: { px: '2.5', py: '1', fontSize: 'xs', minH: '32px' },
              md: { px: '4', py: '2', fontSize: 'sm', minH: '40px' },
            },
          },
          defaultVariants: { variant: 'primary', size: 'md' },
        },
        card: {
          className: 'card',
          base: {
            bg: 'bg.surface',
            // Depth comes from the shadow and from the surface being a
            // different tone than the page, not from a 1px gray line. The
            // old `1px solid bd.default` border is gone on purpose: with a
            // dozen stacked cards, the lines were the loudest thing on
            // screen. bd.* is still used for dividers INSIDE a card, where
            // a line is the right tool.
            //
            // borderRadius is a literal 16px, not the `xl` token: every rem
            // token scales with the live font-size control
            // (src/lib/use-font-scale.ts), and a corner radius that grows
            // with the text size turns cards into lozenges at 24px.
            borderRadius: '16px',
            // The comps' own card shadows: a plain black drop shadow,
            // deeper in the darker themes. A standing magenta neon edge
            // with a cyan inner glow used to sit here for one theme — that
            // was my invention, and no artboard has ever shown anything of
            // the kind, just the shadow below. A theme's neon comes only
            // from where its comp puts it: the page title, the glow behind
            // the primary button, and the icons.
            boxShadow: '0 4px 14px rgba(23, 23, 26, 0.08)',
            _dark: { boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)' },
            _catppuccin: { boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)' },
            // A coloured shadow under every card was tried here once and
            // dropped on sight (Camille, 2026-11-17): it muddied the page.
            // The depth is black in all three, like everywhere else; their
            // colour comes from the surfaces, the tags and the accent, not
            // from the shadows.
            _nightdrive: { boxShadow: '0 8px 28px rgba(0, 0, 0, 0.5)' },
            _lemongrid: { boxShadow: '0 8px 28px rgba(0, 0, 0, 0.5)' },
            _keppel: { boxShadow: '0 8px 28px rgba(0, 0, 0, 0.5)' },
            _matrix: { boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4)' },
            _sonicmania: { boxShadow: '0 6px 18px rgba(10, 34, 41, 0.25)' },
            _contraste: { boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4)' },
          },
        },
      },
    },
  },
});
