import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  preflight: true,
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'src/styled-system',
  globalCss: {
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
        },
      },
    },
  },
});
