import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'src/styled-system',
  // Nine self-contained themes selected via a single `data-theme` attribute
  // on <html> (apps/web/src/lib/use-theme.ts) — not a theme × light/dark
  // matrix. `dark` is redefined (on top of its built-in `.dark`-class
  // selector) so every theme resolves through the same mechanism; `base`
  // in semantic tokens below already IS the light theme, so no `light`
  // condition is needed. `matrix` is the original neon-green/yellow look
  // that used to be named `cyberpunk`, renamed once an actual
  // Cyberpunk-2077-styled (black/yellow/cyan) theme was added under that name.
  conditions: {
    extend: {
      dark: '[data-theme="dark"] &',
      catppuccin: '[data-theme="catppuccin"] &',
      cyberpunk: '[data-theme="cyberpunk"] &',
      matrix: '[data-theme="matrix"] &',
      nintendo: '[data-theme="nintendo"] &',
      megadrive: '[data-theme="megadrive"] &',
      sonicmania: '[data-theme="sonicmania"] &',
    },
  },
  globalCss: {
    // Root font-size, not 16px (browser default). Every rem-based token —
    // fontSize, spacing (padding/gap), and the maxW container widths — scales
    // proportionally from this one value, app-wide, with zero per-component
    // changes. Bumped more than once after feedback that the first +1px
    // nudge was too timid; this is a real, visible jump, not a rounding
    // error — if it's too much (or still not enough) the fix is this one
    // line, not a re-audit of every component.
    html: {
      fontSize: '22px',
    },
    'html, body': {
      bg: 'bg.page',
      color: 'fg.default',
    },
    'input, textarea, select': {
      bg: 'bg.page',
      color: 'fg.default',
    },
  },
  theme: {
    extend: {
      tokens: {
        fonts: {
          sans: {
            value:
              "'Inter Variable', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
          },
        },
      },
      // Cyberpunk-only: a slow breathing glow for the primary CTA, so the
      // neon reads as an actual lit sign rather than a static colored
      // shadow. Every other theme ignores this — nothing references it
      // outside the button recipe's `_cyberpunk` primary variant below.
      keyframes: {
        'neon-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 10px #FDF500, 0 0 24px rgba(253, 245, 0, 0.35)',
          },
          '50%': {
            boxShadow: '0 0 18px #FDF500, 0 0 44px rgba(253, 245, 0, 0.6)',
          },
        },
      },
      semanticTokens: {
        colors: {
          // Catppuccin Mocha, Matrix (neon green/yellow), Cyberpunk (CD
          // Projekt-style black/yellow/cyan), Nintendo and Megadrive hex
          // values below are literals, not {colors.*} scale refs — Panda's
          // default color scale doesn't have these hues/steps, so each
          // theme's values are hardcoded directly here, in one place.
          //
          // Nintendo and Megadrive: no official Nintendo/Sega brand spec
          // exists for "Mario red" or "Sonic blue" (checked — every public
          // hex chart for these is a third-party fan sample, and they
          // disagree with each other), so every hue below is pixel-sampled
          // directly from reference screenshots (captures/interface_mario.png,
          // captures/interface_sonic_1.png) with a small sampling script —
          // hand-picked/estimated values kept drifting off (too neon, wrong
          // shade) compared to the real thing.
          //
          // Cyberpunk was originally hand-picked (black/yellow/cyan,
          // CD Projekt-style) with no source at all; it's now re-grounded
          // in captures/palette cyberpunk.png, a named Coolors "CyberPunk
          // 2077 Palette" swatch (Raisin Black #272932, Blood Red #710000,
          // Rich Lemon #FDF500, Keppel #1AC5B0, Electric Blue #37EBF3,
          // Blushing Purple #9370DB, Frostbite #E455AE, Steel Pink
          // #CB1DCD, Pale Silver #D1C5C0) — flat named hexes, not a UI
          // screenshot, so no pixel sampling here, just a direct mapping.
          // Rich Lemon turned out nearly identical to the already-shipped
          // hand-picked yellow (a good sign the original choice was
          // already on target) and now replaces it outright. bg.page/
          // surface/muted and bd.* are same-hue darker/lighter steps off
          // Raisin Black — safe to darken much further than Sonic Mania's
          // page could be, because Raisin Black is already dark AND
          // desaturated (S≈0.12): darkening a vivid, highly-saturated
          // color is what went muddy for Sonic Mania, darkening an
          // already-neutral dark color is just normal dark-UI chrome.
          // fg.* stays exactly as it was — already verified against the
          // new, very similar darks.
          //
          // First pass of this reshuffle kept Electric Blue as accent2 —
          // Camille called it out as indistinguishable from the original
          // hand-picked look ("je ne comprend pas le thème cyberpunk n'a
          // rien de changé") and asked for an actual neon ambiance. accent2
          // is now Steel Pink (a hue this palette supplies and the old
          // theme never used at all, so it reads as genuinely new), and
          // Electric Blue moves to status.info instead of sitting unused
          // behind the identical-looking accent2. status.success is Keppel,
          // used raw; status.danger is Blood Red brightened at the same hue
          // (the raw swatch is far too dark to use as text); status.warning
          // is unchanged (still orange — no equivalent hue in this palette,
          // and it already has its own reason not to be yellow, see below).
          // Frostbite and Pale Silver are in the reference but have no
          // natural slot in this token set, so they aren't used. The actual
          // "neon" feel comes from glow (box-shadow) on accent-colored
          // buttons and active/selected states, added as `_cyberpunk`
          // conditions directly where those components are styled (the
          // button recipe, GameFilters chips, the preset/destination
          // selection cards) — flat hex alone read as "dark theme with a
          // yellow accent," not neon, no matter how official the hex.
          //
          // Second pass: Camille pointed out that even with the glow,
          // yellow/magenta/dark-gray was still only two neons doing all
          // the work — Electric Blue and Blushing Purple were in the
          // palette but invisible in practice (info.text and bd.strong are
          // not places anyone looks). Electric Blue now also drives every
          // `_focusVisible` ring/glow across the app (search fields,
          // inputs, the keyboard-focused game row) instead of the default
          // yellow-based focus style — a legitimately different role
          // (focus vs. primary action vs. secondary/suggested action), not
          // a re-skin for its own sake, and one every theme already had a
          // *a* color for, just not its own. bd.strong is retinted from
          // neutral dark gray to a dark Blushing-Purple-hued tone instead —
          // it's a low-contrast structural border either way, so the tint
          // costs nothing and gives every card/divider a faint neon-city
          // undertone at rest, independent of the deliberate bright glow
          // on interactive elements.
          //
          // Third pass: still not enough — Camille's actual complaint was
          // that the *named swatches themselves* had stopped being
          // recognizable once every one of them got darkened/desaturated
          // into near-black UI chrome. Fix: stop treating the palette as
          // "hue inspiration" and use the literal swatches wherever
          // contrast allows it. bg.surface is now literal Raisin Black
          // (#272932, not a derived near-black); bd.strong is literal
          // Blushing Purple (#9370DB) at full strength, not a dark tint —
          // every card border/glow in the app is now visibly that purple,
          // not a hint of it. fg.default/muted/subtle/faint are a ramp off
          // literal Pale Silver (#D1C5C0) instead of a generic cool gray —
          // body text itself now carries the palette. accent2.hover is
          // literal Frostbite (#E455AE) instead of a manually darkened
          // Steel Pink — two named palette pinks forming an actual
          // solid/hover pair. status.danger.subtle is literal Blood Red
          // (#710000) as a real dark-red badge wash (its brightened
          // sibling still carries the *text*, since #710000 itself is too
          // dark to read) instead of reusing the generic neutral surface —
          // the one color name that is its own semantic ("Blood Red" =
          // danger) now actually looks like blood red, not a gray box.
          // status.success/info `.subtleBorder` are literal Keppel and
          // Electric Blue respectively instead of a neutral border, so
          // every status badge's edge now matches its own text color.
          // Rich Lemon (already the primary accent) and Steel Pink (already
          // accent2) needed no further change — they were already literal.
          // That leaves only warning (still orange — no equivalent hue in
          // this palette) and Frostbite's sibling Pale Silver as the sole
          // remaining non-literal pieces of the whole theme.
          //
          // Fourth pass: literal Raisin Black is still, on its own terms, a
          // desaturated navy-GRAY (S≈0.12) — using it straight for
          // bg.page/surface read as "gray" exactly as designed, which is
          // the opposite of what a neon background needs. bg.page/surface/
          // muted and bd.subtle/default are no longer Raisin-Black-derived
          // at all: they're a deep, properly saturated (S≈0.65) violet-
          // magenta blended from Blushing Purple's and Steel Pink's hues —
          // dark enough to stay a background, saturated enough to read as
          // an actual color rather than "dark theme, gray, with accents."
          // Raisin Black itself is no longer used anywhere in this theme.
          //
          // Nintendo samples interface_mario.png (an actual Mario-skinned
          // phone UI): bg.surface/muted is the red widget card (muted
          // reuses that same card's own darker inset-shadow red, not an
          // invented hover tint), and accent is its gold/coin dock color.
          // bg.page is the screenshot's sky blue, but darkened at the same
          // hue/saturation (not re-hued) — the raw sampled sky is a bright
          // pastel meant for light-mode phone UI, and every fg.* text token
          // here is a light-on-dark ramp shared across bg.page AND
          // bg.surface; at the raw brightness, that same light text fails
          // contrast on bg.page (passes fine on the red surface). Darkening
          // the sampled hue is the fix that keeps one fg.* ramp legible
          // everywhere without forking it into a page-specific and a
          // surface-specific variant.
          //
          // Megadrive samples interface_sonic_1.png (an actual Sonic-
          // skinned settings menu): bg.page is its background wall blue,
          // bg.surface/muted are the row-fill blue and a brighter same-hue
          // variant for hover, bd.* are its dark inset/outline navy, accent
          // is the "Battle Settings" button's red, accent2 and
          // status.warning are its gold zigzag trim, and status.success is
          // its toggle's green.
          //
          // Megadrive's primary accent is red, so its danger status borrows
          // orange instead to avoid reading as "another primary button";
          // Nintendo's primary accent is gold, so plain red is safe there.
          //
          // Sonic Mania is a third, visually distinct console/game theme —
          // sampled from captures/interface_sonic_2.png (the yellow-walled
          // main menu) and captures/interface_sonic_3.png (the cyan options
          // panel), not from Megadrive's interface_sonic_1.png (a different
          // game's UI, hence a separate theme instead of overwriting
          // Megadrive). Unlike every other theme here, bg.page and
          // bg.surface are the raw sampled vivid gold and cyan — undarkened
          // — because an earlier same-hue-darkened attempt (the trick used
          // for Nintendo's page) turned the gold into a muddy brown and
          // lost exactly the vivid look the reference has; Camille called
          // it out directly. Since a shared LIGHT fg.* ramp can't work on
          // backgrounds this bright, Sonic Mania flips to a DARK fg.* ramp
          // instead — the same light-background pattern the base `light`
          // theme already uses, not a new mechanism. bd.* are the panel's
          // own sampled navy divider tones (still dark — they read as
          // dividers against either vivid background, and double as the
          // reference's actual black bars). accent is the sampled
          // magenta-red of the "B — Back" button, chosen as the PRIMARY
          // accent specifically because the sampled gold is too close to
          // bg.page's own hue to read as a distinct call-to-action there;
          // accent2 is that sampled gold instead, used only where it sits
          // next to its siblings (chips, selection wash) rather than
          // floating directly over bg.page. Status badge washes
          // (success/danger/warning/info `.subtle`) are light pastels
          // here instead of the dark-navy wash every other theme reuses
          // from bd.subtle, because Sonic Mania's status *text* is now
          // dark (to read on the vivid page/surface) and dark text on a
          // dark badge wash would be illegible.
          bg: {
            page: {
              value: {
                base: 'white',
                _dark: '{colors.gray.900}',
                _catppuccin: '#1e1e2e',
                _cyberpunk: '#260B32',
                _matrix: '#0a0f0a',
                _nintendo: '#0B436A',
                _megadrive: '#0C1E80',
                _sonicmania: '#E7CB05',
              },
            },
            surface: {
              value: {
                base: '{colors.gray.50}',
                _dark: '{colors.gray.800}',
                _catppuccin: '#313244',
                _cyberpunk: '#3C1150',
                _matrix: '#10160f',
                _nintendo: '#D43D26',
                _megadrive: '#094BE8',
                _sonicmania: '#31A2F7',
              },
            },
            muted: {
              value: {
                base: '{colors.gray.100}',
                _dark: '{colors.gray.700}',
                _catppuccin: '#45475a',
                _cyberpunk: '#4F1669',
                _matrix: '#1a241a',
                _nintendo: '#B9321F',
                _megadrive: '#1B59EF',
                _sonicmania: '#58B4F9',
              },
            },
          },
          bd: {
            subtle: {
              value: {
                base: '{colors.gray.100}',
                _dark: '{colors.gray.700}',
                _catppuccin: '#45475a',
                _cyberpunk: '#320E43',
                _matrix: '#1f2e1f',
                _nintendo: '#4A2E26',
                _megadrive: '#052852',
                _sonicmania: '#0B2336',
              },
            },
            default: {
              value: {
                base: '{colors.gray.200}',
                _dark: '{colors.gray.600}',
                _catppuccin: '#585b70',
                _cyberpunk: '#4C1565',
                _matrix: '#2d4a2d',
                _nintendo: '#6E3C30',
                _megadrive: '#0A1B53',
                _sonicmania: '#123A59',
              },
            },
            strong: {
              value: {
                base: '{colors.gray.300}',
                _dark: '{colors.gray.500}',
                _catppuccin: '#6c7086',
                _cyberpunk: '#9370DB',
                _matrix: '#3f6b3f',
                _nintendo: '#A85C46',
                _megadrive: '#0E39B4',
                _sonicmania: '#1D6194',
              },
            },
          },
          fg: {
            heading: {
              value: {
                base: '{colors.gray.800}',
                _dark: '{colors.gray.100}',
                _catppuccin: '#cdd6f4',
                _cyberpunk: '#FFFFFF',
                _matrix: '#39ff14',
                _nintendo: '#FFFBF2',
                _megadrive: '#FFFFFF',
                _sonicmania: '#0D0D0D',
              },
            },
            default: {
              value: {
                base: '{colors.gray.700}',
                _dark: '{colors.gray.200}',
                _catppuccin: '#bac2de',
                _cyberpunk: '#D1C5C0',
                _matrix: '#c8ffcf',
                _nintendo: '#F7E6D2',
                _megadrive: '#E4ECFF',
                _sonicmania: '#202020',
              },
            },
            muted: {
              value: {
                base: '{colors.gray.600}',
                _dark: '{colors.gray.300}',
                _catppuccin: '#a6adc8',
                _cyberpunk: '#BAA8A1',
                _matrix: '#8fae8f',
                _nintendo: '#E0BFA0',
                _megadrive: '#C7D6FF',
                _sonicmania: '#343434',
              },
            },
            subtle: {
              value: {
                base: '{colors.gray.500}',
                _dark: '{colors.gray.400}',
                _catppuccin: '#9399b2',
                _cyberpunk: '#A58D83',
                _matrix: '#6b8a6b',
                _nintendo: '#C49B7D',
                _megadrive: '#A9BFFA',
                _sonicmania: '#404040',
              },
            },
            faint: {
              value: {
                base: '{colors.gray.400}',
                _dark: '{colors.gray.500}',
                _catppuccin: '#7f849c',
                _cyberpunk: '#886E63',
                _matrix: '#4a614a',
                _nintendo: '#9C7860',
                _megadrive: '#9AB2EE',
                _sonicmania: '#4E4E4E',
              },
            },
          },
          // The app's single primary action color — one place to retune it.
          // Mirrors the blue.* values every button/link already used in
          // hardcoded form, so this is a drop-in replacement, not a new look.
          // `fg` is the text color used ON TOP of `solid` — white works for
          // the saturated blue.500, but Catppuccin's mauve and Cyberpunk's
          // neon green are pastel/bright enough that dark text reads better.
          accent: {
            solid: {
              value: {
                base: '{colors.blue.500}',
                _dark: '{colors.blue.500}',
                _catppuccin: '#cba6f7',
                _cyberpunk: '#FDF500',
                _matrix: '#39ff14',
                _nintendo: '#FFC933',
                _megadrive: '#D61C1D',
                _sonicmania: '#CF1646',
              },
            },
            hover: {
              value: {
                base: '{colors.blue.600}',
                _dark: '{colors.blue.400}',
                _catppuccin: '#b4befe',
                _cyberpunk: '#D6CF00',
                _matrix: '#6bff57',
                _nintendo: '#FFE066',
                _megadrive: '#AB1517',
                _sonicmania: '#A61238',
              },
            },
            subtle: {
              value: {
                base: '{colors.blue.50}',
                _dark: '{colors.blue.900}',
                _catppuccin: '#45475a',
                _cyberpunk: '#292800',
                _matrix: '#142414',
                _nintendo: '#4A3A1A',
                _megadrive: '#081389',
                _sonicmania: '#473A00',
              },
            },
            subtleBorder: {
              value: {
                base: '{colors.blue.200}',
                _dark: '{colors.blue.700}',
                _catppuccin: '#6c7086',
                _cyberpunk: '#8A7828',
                _matrix: '#2d4a2d',
                _nintendo: '#6E5A28',
                _megadrive: '#27B0FE',
                _sonicmania: '#EFC300',
              },
            },
            text: {
              value: {
                base: '{colors.blue.600}',
                _dark: '{colors.blue.400}',
                _catppuccin: '#cba6f7',
                _cyberpunk: '#FDF500',
                _matrix: '#39ff14',
                _nintendo: '#FFD166',
                _megadrive: '#9FE3FF',
                _sonicmania: '#FFD51A',
              },
            },
            fg: {
              value: {
                base: 'white',
                _dark: 'white',
                _catppuccin: '#1e1e2e',
                _cyberpunk: '#1A1900',
                _matrix: '#06100a',
                _nintendo: '#0B436A',
                _megadrive: 'white',
                _sonicmania: 'white',
              },
            },
          },
          // Status colors used for error/success/warning/info text and the
          // light "wash" badges (Chip, LayoutBadge, DownloadManager status
          // dots...). base/_dark preserve exactly what was hardcoded inline
          // across ~18 files before this token existed — zero visual change
          // there. Catppuccin/Cyberpunk use a neutral surface + colored
          // text/border instead of a hue-tinted background: neither palette
          // defines tinted-surface variants per accent, so a colored wash
          // would be an invented look, not an idiomatic one.
          status: {
            success: {
              subtle: {
                value: {
                  base: '{colors.green.50}',
                  _dark: '{colors.green.950}',
                  _catppuccin: '#313244',
                  _cyberpunk: '#272932',
                  _matrix: '#10160f',
                  _nintendo: '#4A2E26',
                  _megadrive: '#052852',
                  _sonicmania: '#DEFCF0',
                },
              },
              subtleBorder: {
                value: {
                  base: '{colors.green.200}',
                  _dark: '{colors.green.800}',
                  _catppuccin: '#585b70',
                  _cyberpunk: '#1AC5B0',
                  _matrix: '#2d4a2d',
                  _nintendo: '#6E3C30',
                  _megadrive: '#0A1B53',
                  _sonicmania: '#10BC76',
                },
              },
              text: {
                value: {
                  base: '{colors.green.700}',
                  _dark: '{colors.green.300}',
                  _catppuccin: '#a6e3a1',
                  _cyberpunk: '#1AC5B0',
                  _matrix: '#39ff14',
                  _nintendo: '#3FDE7A',
                  _megadrive: '#71FF96',
                  _sonicmania: '#085C3A',
                },
              },
            },
            danger: {
              subtle: {
                value: {
                  base: '{colors.red.50}',
                  _dark: '{colors.red.950}',
                  _catppuccin: '#313244',
                  _cyberpunk: '#710000',
                  _matrix: '#10160f',
                  _nintendo: '#4A2E26',
                  _megadrive: '#052852',
                  _sonicmania: '#FAE2E0',
                },
              },
              subtleBorder: {
                value: {
                  base: '{colors.red.200}',
                  _dark: '{colors.red.800}',
                  _catppuccin: '#585b70',
                  _cyberpunk: '#FF3D3D',
                  _matrix: '#2d4a2d',
                  _nintendo: '#6E3C30',
                  _megadrive: '#0A1B53',
                  _sonicmania: '#DF423A',
                },
              },
              text: {
                value: {
                  base: '{colors.red.600}',
                  _dark: '{colors.red.300}',
                  _catppuccin: '#f38ba8',
                  _cyberpunk: '#FF3D3D',
                  _matrix: '#ff3b3b',
                  _nintendo: '#FF4D4D',
                  // Megadrive's accent is Sonic red — a same-hue danger
                  // would read as "another primary button", not an error.
                  // (Nintendo's accent is gold, so plain red is safe there.)
                  _megadrive: '#ff7a33',
                  _sonicmania: '#8C1D17',
                },
              },
            },
            warning: {
              subtle: {
                value: {
                  base: '{colors.amber.50}',
                  _dark: '{colors.amber.950}',
                  _catppuccin: '#313244',
                  _cyberpunk: '#272932',
                  _matrix: '#10160f',
                  _nintendo: '#4A2E26',
                  _megadrive: '#052852',
                  _sonicmania: '#FFEFDB',
                },
              },
              subtleBorder: {
                value: {
                  base: '{colors.amber.200}',
                  _dark: '{colors.amber.800}',
                  _catppuccin: '#585b70',
                  _cyberpunk: '#ff9d2f',
                  _matrix: '#2d4a2d',
                  _nintendo: '#6E3C30',
                  _megadrive: '#0A1B53',
                  _sonicmania: '#CC6E00',
                },
              },
              text: {
                value: {
                  base: '{colors.amber.700}',
                  _dark: '{colors.amber.300}',
                  _catppuccin: '#f9e2af',
                  // Cyberpunk's accent already owns yellow — orange keeps
                  // warning visually distinct from the primary action color.
                  _cyberpunk: '#ff9d2f',
                  _matrix: '#f9e24a',
                  _nintendo: '#FFC933',
                  _megadrive: '#FBCF0A',
                  _sonicmania: '#7A4200',
                },
              },
              // The only status role with a *solid* usage (ScanPage's
              // "Renommer N fichiers" CTA) — success/danger/info never
              // appear as a filled button, so they don't need this shape.
              solid: {
                value: {
                  base: '{colors.amber.500}',
                  _dark: '{colors.amber.500}',
                  _catppuccin: '#f9e2af',
                  _cyberpunk: '#ff9d2f',
                  _matrix: '#f9e24a',
                  _nintendo: '#FFC933',
                  _megadrive: '#FBCF0A',
                  _sonicmania: '#C96E00',
                },
              },
              hover: {
                value: {
                  base: '{colors.amber.600}',
                  _dark: '{colors.amber.600}',
                  _catppuccin: '#fab387',
                  _cyberpunk: '#ffb65c',
                  _matrix: '#fff066',
                  _nintendo: '#FFE066',
                  _megadrive: '#FFDC4D',
                  _sonicmania: '#A85C00',
                },
              },
              fg: {
                value: {
                  base: 'white',
                  _dark: 'white',
                  _catppuccin: '#1e1e2e',
                  _cyberpunk: '#1a1000',
                  _matrix: '#06100a',
                  _nintendo: '#0B436A',
                  _megadrive: '#0C1E80',
                  _sonicmania: '#0D0D0D',
                },
              },
            },
            info: {
              subtle: {
                value: {
                  base: '{colors.blue.50}',
                  _dark: '{colors.blue.950}',
                  _catppuccin: '#313244',
                  _cyberpunk: '#272932',
                  _matrix: '#10160f',
                  _nintendo: '#4A2E26',
                  _megadrive: '#052852',
                  _sonicmania: '#DDEBFD',
                },
              },
              subtleBorder: {
                value: {
                  base: '{colors.blue.200}',
                  _dark: '{colors.blue.800}',
                  _catppuccin: '#585b70',
                  _cyberpunk: '#37EBF3',
                  _matrix: '#2d4a2d',
                  _nintendo: '#6E3C30',
                  _megadrive: '#0A1B53',
                  _sonicmania: '#267EF3',
                },
              },
              text: {
                value: {
                  base: '{colors.blue.700}',
                  _dark: '{colors.blue.300}',
                  _catppuccin: '#89b4fa',
                  _cyberpunk: '#37EBF3',
                  _matrix: '#39f9ff',
                  _nintendo: '#78C1FF',
                  _megadrive: '#3BC8FE',
                  _sonicmania: '#073A7D',
                },
              },
            },
          },
          // A second, distinct accent the app already used ad hoc (raw
          // violet.*, found during the status-color audit, same problem as
          // accent.* before that token existed): the "suggested by the app"
          // actions (SourcesManager's "✨ Suggérer des sources", its adopt
          // button in SuggestionRow) and the Category filter chips — kept
          // visually separate from the primary accent on purpose.
          accent2: {
            solid: {
              value: {
                base: '{colors.violet.500}',
                _dark: '{colors.violet.500}',
                _catppuccin: '#f5c2e7',
                _cyberpunk: '#CB1DCD',
                _matrix: '#f9e24a',
                _nintendo: '#2F6FD1',
                _megadrive: '#FBCF0A',
                _sonicmania: '#EFC300',
              },
            },
            hover: {
              value: {
                base: '{colors.violet.600}',
                _dark: '{colors.violet.400}',
                _catppuccin: '#f5e0dc',
                _cyberpunk: '#E455AE',
                _matrix: '#fff066',
                _nintendo: '#3F80E0',
                _megadrive: '#FFDC4D',
                _sonicmania: '#D6AF00',
              },
            },
            subtleBorder: {
              value: {
                base: '{colors.violet.200}',
                _dark: '{colors.violet.800}',
                _catppuccin: '#6c7086',
                _cyberpunk: '#4C1565',
                _matrix: '#2d4a2d',
                _nintendo: '#6E3C30',
                _megadrive: '#0A1B53',
                _sonicmania: '#123A59',
              },
            },
            fg: {
              value: {
                base: 'white',
                _dark: 'white',
                _catppuccin: '#1e1e2e',
                _cyberpunk: 'white',
                _matrix: '#06100a',
                _nintendo: 'white',
                _megadrive: '#0C1E80',
                _sonicmania: '#0D0D0D',
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
            fontWeight: 'medium',
            borderRadius: 'lg',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background-color 0.15s, border-color 0.15s, box-shadow 0.15s',
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          },
          variants: {
            variant: {
              // Cyberpunk-only glow (box-shadow in the theme's own accent
              // hues) layered on top of the shared variants below, rather
              // than a parallel set of cyberpunk-specific styles — flat
              // hex alone reads as "dark theme with a yellow accent," not
              // neon, so the glow is what actually sells the ambiance.
              primary: {
                bg: 'accent.solid',
                color: 'accent.fg',
                shadow: 'sm',
                _hover: { bg: 'accent.hover' },
                _cyberpunk: {
                  animation: 'neon-pulse 2.4s ease-in-out infinite',
                },
              },
              secondary: {
                bg: 'bg.surface',
                color: 'fg.default',
                border: '1px solid',
                borderColor: 'bd.strong',
                _cyberpunk: { borderColor: '#37EBF3' },
                _hover: {
                  bg: 'bg.muted',
                  _cyberpunk: { boxShadow: '0 0 12px #CB1DCD, 0 0 28px rgba(203, 29, 205, 0.4)' },
                },
              },
              danger: {
                bg: 'bg.surface',
                color: 'status.danger.text',
                border: '1px solid',
                borderColor: 'status.danger.subtleBorder',
                _hover: {
                  bg: 'status.danger.subtle',
                  _cyberpunk: { boxShadow: '0 0 12px #FF3D3D, 0 0 28px rgba(255, 61, 61, 0.4)' },
                },
              },
              ghost: {
                bg: 'transparent',
                color: 'fg.muted',
                _hover: { bg: 'bg.surface', color: 'fg.default' },
              },
            },
            size: {
              sm: { px: '2.5', py: '1', fontSize: 'xs' },
              md: { px: '4', py: '2', fontSize: 'sm' },
            },
          },
          defaultVariants: { variant: 'primary', size: 'md' },
        },
        card: {
          className: 'card',
          base: {
            bg: 'bg.surface',
            border: '1px solid',
            borderColor: 'bd.default',
            borderRadius: 'xl',
            shadow: 'sm',
            // Cyberpunk-only: every card gets a standing neon edge (not
            // just on hover/active) — a magenta border glow with a faint
            // cyan undertone, so the ambiance is ambient, not purely
            // reactive to clicks.
            _cyberpunk: {
              borderColor: 'rgba(203, 29, 205, 0.5)',
              boxShadow:
                '0 0 1px rgba(203, 29, 205, 0.6), 0 0 14px rgba(203, 29, 205, 0.2), inset 0 0 18px rgba(55, 235, 243, 0.05)',
            },
          },
        },
      },
    },
  },
});
