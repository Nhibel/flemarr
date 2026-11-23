import { pino } from 'pino';
import type { LoggerOptions } from 'pino';
import { currentRequestId } from '@/lib/request-context.js';

const DEFAULT_LEVEL = 'info';
const LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

// A last line of defence: call sites must not log these in the first place.
const SECRET_KEYS = [
  'authorization',
  'Authorization',
  'cookie',
  'Cookie',
  'password',
  'email',
  'archiveOrgAccessKey',
  'archiveOrgSecretKey',
  'archiveOrgLoggedInUser',
  'archiveOrgLoggedInSig',
];

/** LOG_LEVEL when pino knows it: an unknown level would crash the server at startup. */
export function resolveLogLevel(requested: string): string {
  const level = requested.trim().toLowerCase();
  return LEVELS.includes(level) ? level : DEFAULT_LEVEL;
}

export function loggerOptions(level: string): LoggerOptions {
  return {
    level,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    redact: SECRET_KEYS.flatMap((key) => [key, `*.${key}`]),
    mixin: () => {
      const requestId = currentRequestId();
      return requestId === undefined ? {} : { requestId };
    },
  };
}

function configuredLevel(): string {
  const requested = process.env['LOG_LEVEL'];
  if (requested) return resolveLogLevel(requested);
  return process.env['VITEST'] ? 'silent' : DEFAULT_LEVEL;
}

// JSON logs to stdout (ARCHITECTURE.md). Silent during tests, tunable via
// LOG_LEVEL (e.g. LOG_LEVEL=debug to trace HEAD probes and cache hits).
export const logger = pino(loggerOptions(configuredLevel()));
