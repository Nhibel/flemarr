import { resolve } from 'node:path';
import { getSettings } from '@/services/settings/index.js';

/**
 * The single library root, from the ROMS_ROOT env var, resolved to absolute —
 * or null when unset (local dev without Docker). When set it is both the
 * fs-safety boundary and the starting point for directory browsing, so the UI
 * never deals with absolute paths and can't escape above it.
 */
export function libraryRoot(): string | null {
  const raw = process.env['ROMS_ROOT']?.trim();
  return raw ? resolve(raw) : null;
}

/**
 * Allowed roots for the "configured roots only" fs-safety rule: the single
 * ROMS_ROOT when configured, otherwise the per-system paths from settings
 * (legacy behavior, kept for local dev).
 */
export function libraryRoots(): string[] {
  const root = libraryRoot();
  if (root) return [root];
  return Object.values(getSettings().systemPaths);
}
