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
  // Cyberpunk-2077-styled (black/yellow/cyan) theme was added under that name.
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
      cyberpunk: '[data-theme="cyberpunk"] &',
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
          // Seven self-contained themes. Every value below is a literal hex
          // rather than a {colors.*} scale ref, including the `base` (light)
          // theme's: the palette rules these themes follow — no pure neutral
          // ground, a tinted page with the surface floating on it — can't be
          // expressed with Panda's default neutral gray scale, so all seven
          // are stated in the same form, in one place.
          //
          // The rules, decided on the design canvas and applied uniformly:
          //
          //   * bg.page is always tinted, never a pure neutral, and always
          //     distinct from bg.surface. Surfaces are meant to read as
          //     floating on the page, so page == surface would collapse the
          //     whole layout into one flat field.
          //   * Three status roles stay distinguishable: action (accent),
          //     owned (success) and warning. They differ in hue AND in the
          //     lightness of their badge, and the components that use them
          //     add a pictogram, so a red/green pair is never the only
          //     signal.
          //   * Body text clears 4.5:1 on its own background, muted
          //     metadata text included. A bright accent always carries dark
          //     text (accent.fg), never white.
          //   * The bright accent is reserved for the primary action and
          //     for selection. It is not used as general chrome.
          //
          // Accepted compromise in Matrix and Contraste: their accent
          // doubles as the "owned" status color, because both themes are
          // built on a single bright hue and inventing a second one would
          // break their identity. The distinction there is carried by shape
          // — a filled button versus a tinted tag — not by hue.
          //
          // Nintendo and Megadrive were removed (2026-11-15): navy plus a
          // saturated red read poorly down a long game list, and the two
          // themes were hard to tell apart from each other. Contraste
          // replaced them.
          //
          // Catppuccin Mocha uses the official palette names throughout:
          // page is Mantle, surface is Base, muted is Surface0, the border
          // ramp is Surface0/Surface1/Surface2 and the text ramp is
          // Text/Subtext1/Subtext0/Overlay2/Overlay1. Page moved down from
          // Base to Mantle so that Base is free to serve as the floating
          // surface — when both were Base, the two were indistinguishable.
          //
          // Cyberpunk is grounded in captures/palette cyberpunk.png, a named
          // Coolors "CyberPunk 2077 Palette" swatch (Blood Red #710000,
          // Rich Lemon #FDF500, Keppel #1AC5B0, Electric Blue #37EBF3,
          // Blushing Purple #9370DB, Frostbite #E455AE, Steel Pink #CB1DCD,
          // Pale Silver #D1C5C0). Its bg.page/surface/muted, bd.subtle/
          // default and its whole fg.* ramp are deliberately UNCHANGED from
          // the version that shipped before this redesign, and must stay
          // that way: they are the result of four iteration passes, the last
          // of which replaced a desaturated near-black ground with this deep
          // saturated violet-magenta precisely because Camille rejected the
          // desaturated one outright ("je ne comprend pas le thème
          // cyberpunk n'a rien de changé"). The redesign comp for this theme
          // proposed a neutral near-black again; it was discarded on that
          // basis. Rich Lemon stays the accent, Steel Pink stays accent2 and
          // Electric Blue stays status.info — those three hexes are also
          // hardcoded in ~11 component files (focus rings, GameFilters
          // glows, the button recipe's neon pulse), so changing them here
          // without touching those files would desynchronize the theme.
          //
          // Sonic Mania keeps its pixel-sampled values too: bg.page is the
          // raw vivid gold of captures/interface_sonic_2.png's menu wall and
          // bg.surface the raw cyan of interface_sonic_3.png's options
          // panel, both undarkened — an earlier same-hue darkening attempt
          // turned the gold muddy brown and lost the vivid reference look.
          // Because both grounds are that bright, this is the only dark-UI
          // theme with a DARK fg.* ramp and light pastel status washes, the
          // same arrangement the base light theme uses. What did change in
          // the redesign: accent.subtle moved from a dark gold wash to a
          // pale pink, and accent.text from gold to a dark magenta. Gold
          // text on a gold page was effectively invisible, and a dark wash
          // behind dark text was unreadable.
          bg: {
            page: {
              value: {
                base: '#F3F1EC',
                _dark: '#12141A',
                _catppuccin: '#181825',
                _cyberpunk: '#260B32',
                _matrix: '#040C07',
                _sonicmania: '#E7CB05',
                _contraste: '#0A0A0B',
              },
            },
            surface: {
              value: {
                base: '#FFFFFF',
                _dark: '#1B1F28',
                _catppuccin: '#1E1E2E',
                _cyberpunk: '#3C1150',
                _matrix: '#0B170F',
                _sonicmania: '#31A2F7',
                _contraste: '#141417',
              },
            },
            muted: {
              value: {
                base: '#EAE7E0',
                _dark: '#242A36',
                _catppuccin: '#313244',
                _cyberpunk: '#4F1669',
                _matrix: '#142419',
                _sonicmania: '#58B4F9',
                _contraste: '#1D1D21',
              },
            },
          },
          bd: {
            subtle: {
              value: {
                base: '#EDEAE3',
                _dark: '#20252F',
                _catppuccin: '#313244',
                _cyberpunk: '#320E43',
                _matrix: '#0F1E14',
                _sonicmania: '#0B2336',
                _contraste: '#17171A',
              },
            },
            default: {
              value: {
                base: '#E0DCD3',
                _dark: '#2B3240',
                _catppuccin: '#45475A',
                _cyberpunk: '#4C1565',
                _matrix: '#1B3123',
                _sonicmania: '#123A59',
                _contraste: '#26262B',
              },
            },
            strong: {
              value: {
                base: '#CFC9BD',
                _dark: '#3A4356',
                _catppuccin: '#585B70',
                // Literal Blushing Purple at full strength, not a dark
                // tint of it — every card border and divider is visibly
                // that purple, which is what gives the theme its ambient
                // neon-city undertone at rest.
                _cyberpunk: '#9370DB',
                _matrix: '#2E5438',
                _sonicmania: '#1D6194',
                _contraste: '#3A3A42',
              },
            },
          },
          fg: {
            heading: {
              value: {
                base: '#121214',
                _dark: '#F3F5FA',
                _catppuccin: '#CDD6F4',
                _cyberpunk: '#FFFFFF',
                _matrix: '#43F57B',
                _sonicmania: '#0D0D0D',
                _contraste: '#FFFFFF',
              },
            },
            default: {
              value: {
                base: '#17171A',
                _dark: '#ECEEF4',
                _catppuccin: '#BAC2DE',
                // A ramp off literal Pale Silver, so body text itself
                // carries the palette instead of a generic cool gray.
                _cyberpunk: '#D1C5C0',
                _matrix: '#D7F5E0',
                _sonicmania: '#202020',
                _contraste: '#F5F5F6',
              },
            },
            muted: {
              value: {
                base: '#4A4842',
                _dark: '#B9C0CF',
                _catppuccin: '#A6ADC8',
                _cyberpunk: '#BAA8A1',
                _matrix: '#A8CDB4',
                _sonicmania: '#343434',
                _contraste: '#B4B4BC',
              },
            },
            subtle: {
              value: {
                base: '#5E5C55',
                _dark: '#99A1B3',
                _catppuccin: '#9399B2',
                _cyberpunk: '#A58D83',
                _matrix: '#7FAE8E',
                _sonicmania: '#404040',
                _contraste: '#8E8E96',
              },
            },
            faint: {
              value: {
                base: '#7C7A72',
                _dark: '#7B8396',
                _catppuccin: '#7F849C',
                _cyberpunk: '#886E63',
                _matrix: '#5C8A6B',
                _sonicmania: '#4E4E4E',
                _contraste: '#6B6B74',
              },
            },
          },
          // The app's single primary action color — one place to retune it.
          // `fg` is the text color used ON TOP of `solid`: white only where
          // `solid` is saturated enough to carry it, dark text everywhere
          // the accent is bright (Catppuccin's mauve, Cyberpunk's lemon,
          // Matrix's green, Contraste's lime).
          accent: {
            solid: {
              value: {
                base: '#2F5BD9',
                _dark: '#6C8FFF',
                _catppuccin: '#CBA6F7',
                _cyberpunk: '#FDF500',
                _matrix: '#43F57B',
                _sonicmania: '#CF1646',
                _contraste: '#C4F000',
              },
            },
            hover: {
              value: {
                base: '#2449B5',
                _dark: '#8BA6FF',
                _catppuccin: '#DDBFFA',
                _cyberpunk: '#D6CF00',
                _matrix: '#7CFAA5',
                _sonicmania: '#A61238',
                _contraste: '#D8FF33',
              },
            },
            subtle: {
              value: {
                base: '#E8EEFD',
                _dark: '#1A2234',
                _catppuccin: '#2A2140',
                _cyberpunk: '#2E2A0B',
                _matrix: '#0E2615',
                _sonicmania: '#FFE8EF',
                _contraste: '#1E2405',
              },
            },
            subtleBorder: {
              value: {
                base: '#BBCCF7',
                _dark: '#33467A',
                _catppuccin: '#4D3F6B',
                _cyberpunk: '#8A7828',
                _matrix: '#2E5438',
                _sonicmania: '#F0A0B8',
                _contraste: '#5A6E12',
              },
            },
            text: {
              value: {
                base: '#2449B5',
                _dark: '#8BA6FF',
                _catppuccin: '#CBA6F7',
                _cyberpunk: '#FDF500',
                _matrix: '#43F57B',
                // Dark magenta, not the sampled gold: gold text sat on a
                // gold page and could not be seen.
                _sonicmania: '#8C1D3A',
                _contraste: '#C4F000',
              },
            },
            fg: {
              value: {
                base: '#FFFFFF',
                _dark: '#0B0E16',
                _catppuccin: '#1E1E2E',
                _cyberpunk: '#1A1900',
                _matrix: '#04120A',
                _sonicmania: '#FFFFFF',
                _contraste: '#0A0A0B',
              },
            },
          },
          // Status colors for error/success/warning/info text and the
          // tinted badges (Chip, LayoutBadge, DownloadManager status
          // dots...). Every theme now uses a wash tinted with its own role
          // hue. The dark themes previously used a NEUTRAL surface here
          // instead, on the grounds that Catppuccin and Cyberpunk define no
          // tinted-surface variant per accent, so a colored wash would be
          // an invented look. The redesign overrides that deliberately: the
          // status tags are now the main place a row's state is read, and a
          // neutral wash makes all four roles look identical at a glance.
          // The wash hues are derived from each theme's own role text
          // color, so nothing foreign to the palette is introduced.
          status: {
            success: {
              subtle: {
                value: {
                  base: '#D8F0E4',
                  _dark: '#10231D',
                  _catppuccin: '#1C2A20',
                  _cyberpunk: '#0E2E2C',
                  _matrix: '#0E2615',
                  _sonicmania: '#DEFCF0',
                  _contraste: '#1E2405',
                },
              },
              subtleBorder: {
                value: {
                  base: '#A8DCC4',
                  _dark: '#1F6B55',
                  _catppuccin: '#44603F',
                  _cyberpunk: '#1AC5B0',
                  _matrix: '#2E5438',
                  _sonicmania: '#10BC76',
                  _contraste: '#5A6E12',
                },
              },
              text: {
                value: {
                  base: '#0E6B46',
                  _dark: '#35D4A4',
                  _catppuccin: '#A6E3A1',
                  _cyberpunk: '#1AC5B0',
                  // Matrix and Contraste reuse their accent here on
                  // purpose — see the note at the top of this block.
                  _matrix: '#43F57B',
                  _sonicmania: '#085C3A',
                  _contraste: '#C4F000',
                },
              },
            },
            danger: {
              subtle: {
                value: {
                  base: '#FBE4E2',
                  _dark: '#2A1517',
                  _catppuccin: '#2C1A22',
                  // Literal Blood Red as a real dark-red badge wash — the
                  // one swatch in this palette whose name is already its
                  // own semantic. Its brightened sibling carries the text,
                  // since #710000 is too dark to read on.
                  _cyberpunk: '#710000',
                  _matrix: '#2A0F0F',
                  _sonicmania: '#FAE2E0',
                  _contraste: '#2A1212',
                },
              },
              subtleBorder: {
                value: {
                  base: '#F0BEB9',
                  _dark: '#7A3034',
                  _catppuccin: '#6B3A4A',
                  _cyberpunk: '#FF3D3D',
                  _matrix: '#6B2A2A',
                  _sonicmania: '#DF423A',
                  _contraste: '#6B2C2C',
                },
              },
              text: {
                value: {
                  base: '#B3261E',
                  _dark: '#FF8080',
                  _catppuccin: '#F38BA8',
                  _cyberpunk: '#FF3D3D',
                  _matrix: '#FF5C5C',
                  _sonicmania: '#8C1D17',
                  _contraste: '#FF6B6B',
                },
              },
            },
            warning: {
              subtle: {
                value: {
                  base: '#FBE6CC',
                  _dark: '#2A1F10',
                  _catppuccin: '#2C2118',
                  _cyberpunk: '#33210A',
                  _matrix: '#2A2110',
                  _sonicmania: '#FFEFDB',
                  _contraste: '#2A1E08',
                },
              },
              subtleBorder: {
                value: {
                  base: '#F0CFA0',
                  _dark: '#7A5520',
                  _catppuccin: '#6B4A33',
                  _cyberpunk: '#FF9D2F',
                  _matrix: '#6B5520',
                  _sonicmania: '#CC6E00',
                  _contraste: '#6B4A12',
                },
              },
              text: {
                value: {
                  base: '#8A4600',
                  _dark: '#FFB454',
                  _catppuccin: '#FAB387',
                  // Cyberpunk's accent already owns yellow — orange keeps
                  // warning visually distinct from the primary action color.
                  _cyberpunk: '#FF9D2F',
                  _matrix: '#F5C542',
                  _sonicmania: '#7A4200',
                  _contraste: '#FFB020',
                },
              },
              // The only status role with a *solid* usage (ScanPage's
              // "Renommer N fichiers" CTA) — success/danger/info never
              // appear as a filled button, so they don't need this shape.
              solid: {
                value: {
                  base: '#D98A00',
                  _dark: '#E8963A',
                  _catppuccin: '#FAB387',
                  _cyberpunk: '#FF9D2F',
                  _matrix: '#F5C542',
                  _sonicmania: '#C96E00',
                  _contraste: '#FFB020',
                },
              },
              hover: {
                value: {
                  base: '#B87400',
                  _dark: '#FFB454',
                  _catppuccin: '#F8C9A8',
                  _cyberpunk: '#FFB65C',
                  _matrix: '#FFD966',
                  _sonicmania: '#A85C00',
                  _contraste: '#FFC14D',
                },
              },
              fg: {
                value: {
                  base: '#FFFFFF',
                  _dark: '#15100A',
                  _catppuccin: '#1E1E2E',
                  _cyberpunk: '#1A1000',
                  _matrix: '#0F0C02',
                  _sonicmania: '#0D0D0D',
                  _contraste: '#140E00',
                },
              },
            },
            info: {
              subtle: {
                value: {
                  base: '#E3EDFA',
                  _dark: '#141E2E',
                  _catppuccin: '#1A2234',
                  _cyberpunk: '#0C2A2E',
                  _matrix: '#0A2528',
                  _sonicmania: '#DDEBFD',
                  _contraste: '#0A1F2C',
                },
              },
              subtleBorder: {
                value: {
                  base: '#B9D3F0',
                  _dark: '#2C4A75',
                  _catppuccin: '#3C4F75',
                  _cyberpunk: '#37EBF3',
                  _matrix: '#2A5A5E',
                  _sonicmania: '#267EF3',
                  _contraste: '#1E5878',
                },
              },
              text: {
                value: {
                  base: '#1F5AA8',
                  _dark: '#7FB6FF',
                  _catppuccin: '#89B4FA',
                  // Literal Electric Blue. Also hardcoded in every
                  // `_focusVisible` ring across the app, so the two must
                  // stay in sync.
                  _cyberpunk: '#37EBF3',
                  _matrix: '#39F9FF',
                  _sonicmania: '#073A7D',
                  _contraste: '#38BDF8',
                },
              },
            },
          },
          // A second, distinct accent for the "suggested by the app"
          // actions (SourcesManager's suggest button, its adopt button in
          // SuggestionRow) and the Category filter chips — kept visually
          // separate from the primary accent on purpose.
          //
          // Contraste's is a sky blue rather than another lime: its lime is
          // already carrying both the primary action and the owned status,
          // and a third use would erase the distinction entirely.
          accent2: {
            solid: {
              value: {
                base: '#6D44C8',
                _dark: '#A78BFA',
                _catppuccin: '#F5C2E7',
                _cyberpunk: '#CB1DCD',
                _matrix: '#F5C542',
                _sonicmania: '#EFC300',
                _contraste: '#38BDF8',
              },
            },
            hover: {
              value: {
                base: '#5835A8',
                _dark: '#BFA6FC',
                _catppuccin: '#F8D4EE',
                // Literal Frostbite, not a darkened Steel Pink — two named
                // palette pinks forming an actual solid/hover pair.
                _cyberpunk: '#E455AE',
                _matrix: '#FFD966',
                _sonicmania: '#D6AF00',
                _contraste: '#7DD3FC',
              },
            },
            subtleBorder: {
              value: {
                base: '#D5C8F2',
                _dark: '#3E3566',
                _catppuccin: '#5A4257',
                _cyberpunk: '#4C1565',
                _matrix: '#4A3A12',
                _sonicmania: '#B08C00',
                _contraste: '#15425E',
              },
            },
            fg: {
              value: {
                base: '#FFFFFF',
                _dark: '#0B0E16',
                _catppuccin: '#1E1E2E',
                _cyberpunk: '#FFFFFF',
                _matrix: '#0F0C02',
                _sonicmania: '#0D0D0D',
                _contraste: '#04131C',
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
