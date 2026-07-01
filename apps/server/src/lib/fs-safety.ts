import { resolve, sep } from 'node:path';

export class PathTraversalError extends Error {
  constructor(candidate: string, root: string) {
    super(`Path "${candidate}" is outside the allowed root "${root}"`);
    this.name = 'PathTraversalError';
  }
}

/**
 * Throws PathTraversalError if `candidate` is not strictly inside `root`.
 * Both paths are resolved to absolute before comparison.
 */
export function assertWithinRoot(candidate: string, root: string): void {
  const absRoot = resolve(root) + sep;
  const absCandidate = resolve(candidate);

  // Allow the root itself (e.g. destination = root when scanning)
  if (absCandidate !== resolve(root) && !absCandidate.startsWith(absRoot)) {
    throw new PathTraversalError(candidate, root);
  }
}
