import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@/': new URL('./src/', import.meta.url).pathname,
      '@shared/': new URL('../../packages/shared/src/', import.meta.url).pathname,
    },
  },
});
