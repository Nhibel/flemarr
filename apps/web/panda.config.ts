import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'src/styled-system',
  // Four self-contained themes selected via a single `data-theme` attribute
  // on <html> (apps/web/src/lib/use-theme.ts) — not a theme × light/dark
  // matrix. `dark` is redefined (on top of its built-in `.dark`-class
  // selector) so every theme resolves through the same mechanism; `base`
  // in semantic tokens below already IS the light theme, so no `light`
  // condition is needed.
  conditions: {
    extend: {
      dark: '[data-theme="dark"] &',
      catppuccin: '[data-theme="catppuccin"] &',
      cyberpunk: '[data-theme="cyberpunk"] &',
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
      semanticTokens: {
        colors: {
          // Catppuccin Mocha and Cyberpunk (neon green/yellow on near-black)
          // hex values below are literals, not {colors.*} scale refs — Panda's
          // default color scale doesn't have these hues/steps, so each theme's
          // values are hardcoded directly here, in one place.
          bg: {
            page: {
              value: {
                base: 'white',
                _dark: '{colors.gray.900}',
                _catppuccin: '#1e1e2e',
                _cyberpunk: '#0a0f0a',
              },
            },
            surface: {
              value: {
                base: '{colors.gray.50}',
                _dark: '{colors.gray.800}',
                _catppuccin: '#313244',
                _cyberpunk: '#10160f',
              },
            },
            muted: {
              value: {
                base: '{colors.gray.100}',
                _dark: '{colors.gray.700}',
                _catppuccin: '#45475a',
                _cyberpunk: '#1a241a',
              },
            },
          },
          bd: {
            subtle: {
              value: {
                base: '{colors.gray.100}',
                _dark: '{colors.gray.700}',
                _catppuccin: '#45475a',
                _cyberpunk: '#1f2e1f',
              },
            },
            default: {
              value: {
                base: '{colors.gray.200}',
                _dark: '{colors.gray.600}',
                _catppuccin: '#585b70',
                _cyberpunk: '#2d4a2d',
              },
            },
            strong: {
              value: {
                base: '{colors.gray.300}',
                _dark: '{colors.gray.500}',
                _catppuccin: '#6c7086',
                _cyberpunk: '#3f6b3f',
              },
            },
          },
          fg: {
            heading: {
              value: {
                base: '{colors.gray.800}',
                _dark: '{colors.gray.100}',
                _catppuccin: '#cdd6f4',
                _cyberpunk: '#39ff14',
              },
            },
            default: {
              value: {
                base: '{colors.gray.700}',
                _dark: '{colors.gray.200}',
                _catppuccin: '#bac2de',
                _cyberpunk: '#c8ffcf',
              },
            },
            muted: {
              value: {
                base: '{colors.gray.600}',
                _dark: '{colors.gray.300}',
                _catppuccin: '#a6adc8',
                _cyberpunk: '#8fae8f',
              },
            },
            subtle: {
              value: {
                base: '{colors.gray.500}',
                _dark: '{colors.gray.400}',
                _catppuccin: '#9399b2',
                _cyberpunk: '#6b8a6b',
              },
            },
            faint: {
              value: {
                base: '{colors.gray.400}',
                _dark: '{colors.gray.500}',
                _catppuccin: '#7f849c',
                _cyberpunk: '#4a614a',
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
                _cyberpunk: '#39ff14',
              },
            },
            hover: {
              value: {
                base: '{colors.blue.600}',
                _dark: '{colors.blue.400}',
                _catppuccin: '#b4befe',
                _cyberpunk: '#6bff57',
              },
            },
            subtle: {
              value: {
                base: '{colors.blue.50}',
                _dark: '{colors.blue.900}',
                _catppuccin: '#45475a',
                _cyberpunk: '#142414',
              },
            },
            subtleBorder: {
              value: {
                base: '{colors.blue.200}',
                _dark: '{colors.blue.700}',
                _catppuccin: '#6c7086',
                _cyberpunk: '#2d4a2d',
              },
            },
            text: {
              value: {
                base: '{colors.blue.600}',
                _dark: '{colors.blue.400}',
                _catppuccin: '#cba6f7',
                _cyberpunk: '#39ff14',
              },
            },
            fg: {
              value: {
                base: 'white',
                _dark: 'white',
                _catppuccin: '#1e1e2e',
                _cyberpunk: '#06100a',
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
                  _cyberpunk: '#10160f',
                },
              },
              subtleBorder: {
                value: {
                  base: '{colors.green.200}',
                  _dark: '{colors.green.800}',
                  _catppuccin: '#585b70',
                  _cyberpunk: '#2d4a2d',
                },
              },
              text: {
                value: {
                  base: '{colors.green.700}',
                  _dark: '{colors.green.300}',
                  _catppuccin: '#a6e3a1',
                  _cyberpunk: '#39ff14',
                },
              },
            },
            danger: {
              subtle: {
                value: {
                  base: '{colors.red.50}',
                  _dark: '{colors.red.950}',
                  _catppuccin: '#313244',
                  _cyberpunk: '#10160f',
                },
              },
              subtleBorder: {
                value: {
                  base: '{colors.red.200}',
                  _dark: '{colors.red.800}',
                  _catppuccin: '#585b70',
                  _cyberpunk: '#2d4a2d',
                },
              },
              text: {
                value: {
                  base: '{colors.red.600}',
                  _dark: '{colors.red.300}',
                  _catppuccin: '#f38ba8',
                  _cyberpunk: '#ff3b3b',
                },
              },
            },
            warning: {
              subtle: {
                value: {
                  base: '{colors.amber.50}',
                  _dark: '{colors.amber.950}',
                  _catppuccin: '#313244',
                  _cyberpunk: '#10160f',
                },
              },
              subtleBorder: {
                value: {
                  base: '{colors.amber.200}',
                  _dark: '{colors.amber.800}',
                  _catppuccin: '#585b70',
                  _cyberpunk: '#2d4a2d',
                },
              },
              text: {
                value: {
                  base: '{colors.amber.700}',
                  _dark: '{colors.amber.300}',
                  _catppuccin: '#f9e2af',
                  _cyberpunk: '#f9e24a',
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
                  _cyberpunk: '#f9e24a',
                },
              },
              hover: {
                value: {
                  base: '{colors.amber.600}',
                  _dark: '{colors.amber.600}',
                  _catppuccin: '#fab387',
                  _cyberpunk: '#fff066',
                },
              },
              fg: {
                value: {
                  base: 'white',
                  _dark: 'white',
                  _catppuccin: '#1e1e2e',
                  _cyberpunk: '#06100a',
                },
              },
            },
            info: {
              subtle: {
                value: {
                  base: '{colors.blue.50}',
                  _dark: '{colors.blue.950}',
                  _catppuccin: '#313244',
                  _cyberpunk: '#10160f',
                },
              },
              subtleBorder: {
                value: {
                  base: '{colors.blue.200}',
                  _dark: '{colors.blue.800}',
                  _catppuccin: '#585b70',
                  _cyberpunk: '#2d4a2d',
                },
              },
              text: {
                value: {
                  base: '{colors.blue.700}',
                  _dark: '{colors.blue.300}',
                  _catppuccin: '#89b4fa',
                  _cyberpunk: '#39f9ff',
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
                _cyberpunk: '#f9e24a',
              },
            },
            hover: {
              value: {
                base: '{colors.violet.600}',
                _dark: '{colors.violet.400}',
                _catppuccin: '#f5e0dc',
                _cyberpunk: '#fff066',
              },
            },
            subtleBorder: {
              value: {
                base: '{colors.violet.200}',
                _dark: '{colors.violet.800}',
                _catppuccin: '#6c7086',
                _cyberpunk: '#2d4a2d',
              },
            },
            fg: {
              value: {
                base: 'white',
                _dark: 'white',
                _catppuccin: '#1e1e2e',
                _cyberpunk: '#06100a',
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
              primary: {
                bg: 'accent.solid',
                color: 'accent.fg',
                shadow: 'sm',
                _hover: { bg: 'accent.hover' },
              },
              secondary: {
                bg: 'bg.page',
                color: 'fg.default',
                border: '1px solid',
                borderColor: 'bd.strong',
                _hover: { bg: 'bg.surface' },
              },
              danger: {
                bg: 'bg.page',
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
            bg: 'bg.page',
            border: '1px solid',
            borderColor: 'bd.default',
            borderRadius: 'xl',
            shadow: 'sm',
          },
        },
      },
    },
  },
});
