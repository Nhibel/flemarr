import { resolve, sep } from 'node:path';

export class PathTraversalError extends Error {
  constructor(candidate: string, root: string) {
    super(`Path "${candidate}" is outside the allowed root "${root}"`);
    this.name = 'PathTraversalError';
  }
}

export class NoRootsConfiguredError extends Error {
  constructor() {
    super('No system paths configured — set at least one directory in settings first');
    this.name = 'NoRootsConfiguredError';
  }
}

// Windows paths are case-insensitive; compare canonicalized forms.
function canonical(p: string): string {
  const abs = resolve(p);
  return process.platform === 'win32' ? abs.toLowerCase() : abs;
}

export function isWithinRoot(candidate: string, root: string): boolean {
  const absRoot = canonical(root);
  const absCandidate = canonical(candidate);
  return absCandidate === absRoot || absCandidate.startsWith(absRoot + sep);
}

/**
 * Throws PathTraversalError if `candidate` is not the root itself or inside it.
 * Both paths are resolved to absolute before comparison.
 */
export function assertWithinRoot(candidate: string, root: string): void {
  if (!isWithinRoot(candidate, root)) {
    throw new PathTraversalError(candidate, root);
  }
}

/**
 * The "configured roots only" rule from ARCHITECTURE.md: every filesystem
 * operation must target a path inside one of the user-configured system paths.
 */
export function assertWithinConfiguredRoots(candidate: string, roots: string[]): void {
  if (roots.length === 0) {
    throw new NoRootsConfiguredError();
  }
  if (!roots.some((root) => isWithinRoot(candidate, root))) {
    throw new PathTraversalError(candidate, roots.join('", "'));
  }
}
