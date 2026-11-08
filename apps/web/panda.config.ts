import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'src/styled-system',
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
          bg: {
            page: { value: { base: 'white', _dark: '{colors.gray.900}' } },
            surface: { value: { base: '{colors.gray.50}', _dark: '{colors.gray.800}' } },
            muted: { value: { base: '{colors.gray.100}', _dark: '{colors.gray.700}' } },
          },
          bd: {
            subtle: { value: { base: '{colors.gray.100}', _dark: '{colors.gray.700}' } },
            default: { value: { base: '{colors.gray.200}', _dark: '{colors.gray.600}' } },
            strong: { value: { base: '{colors.gray.300}', _dark: '{colors.gray.500}' } },
          },
          fg: {
            heading: { value: { base: '{colors.gray.800}', _dark: '{colors.gray.100}' } },
            default: { value: { base: '{colors.gray.700}', _dark: '{colors.gray.200}' } },
            muted: { value: { base: '{colors.gray.600}', _dark: '{colors.gray.300}' } },
            subtle: { value: { base: '{colors.gray.500}', _dark: '{colors.gray.400}' } },
            faint: { value: { base: '{colors.gray.400}', _dark: '{colors.gray.500}' } },
          },
          // The app's single primary action color — one place to retune it.
          // Mirrors the blue.* values every button/link already used in
          // hardcoded form, so this is a drop-in replacement, not a new look.
          accent: {
            solid: { value: { base: '{colors.blue.500}', _dark: '{colors.blue.500}' } },
            hover: { value: { base: '{colors.blue.600}', _dark: '{colors.blue.400}' } },
            subtle: { value: { base: '{colors.blue.50}', _dark: '{colors.blue.900}' } },
            subtleBorder: { value: { base: '{colors.blue.200}', _dark: '{colors.blue.700}' } },
            text: { value: { base: '{colors.blue.600}', _dark: '{colors.blue.400}' } },
            fg: { value: { base: 'white', _dark: 'white' } },
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
                color: 'red.600',
                border: '1px solid',
                borderColor: 'red.200',
                _hover: { bg: 'red.50' },
                _dark: { borderColor: 'red.700', _hover: { bg: 'red.950' } },
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
