import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'src/styled-system',
  globalCss: {
    // 17px root — every rem-based fontSize token grows proportionally from
    // here, app-wide, without touching individual components.
    html: {
      fontSize: '17px',
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
    },
  },
});
