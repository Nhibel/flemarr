import { defineConfig } from 'tsup';

// esbuild resolves the @/ and @shared/ tsconfig paths, so packages/shared source
// is bundled into dist/ — runtime deps (hono, better-sqlite3, …) stay external.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  clean: true,
  sourcemap: true,
});
