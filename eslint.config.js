// @ts-check
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/styled-system/**',
      '**/.vite/**',
      '**/coverage/**',
    ],
  },
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // .claude/rules/readability.md: one level of ternary at most.
      'no-nested-ternary': 'error',
    },
  },
  {
    // .claude/rules/frontend.md — the server isn't held to these.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
    },
  },
);
