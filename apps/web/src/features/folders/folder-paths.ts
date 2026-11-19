/** The last segment of a path, ignoring trailing separators. Works for `/` and `\`. */
export function pathBasename(path: string): string {
  const withoutTrailingSeparator = path.replace(/[\\/]+$/, '');
  const segments = withoutTrailingSeparator.split(/[\\/]/);
  return segments.pop() ?? path;
}

/** Joins a child name onto a listed directory, keeping that directory's own separator. */
export function joinPath(base: string, name: string): string {
  const trimmed = base.replace(/[\\/]+$/, '');
  const separator = trimmed.includes('\\') ? '\\' : '/';
  return `${trimmed}${separator}${name}`;
}
