import { pino } from 'pino';

// JSON logs to stdout (ARCHITECTURE.md). Silent during tests, tunable via
// LOG_LEVEL (e.g. LOG_LEVEL=debug to trace HEAD probes and cache hits).
export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? (process.env['VITEST'] ? 'silent' : 'info'),
  base: undefined,
});
