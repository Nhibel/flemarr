/**
 * Display helpers for library paths. When a library root (ROMS_ROOT) is
 * configured, the UI shows paths relative to it ("/SNES" instead of
 * "/roms/SNES"): the container mount point is an implementation detail the
 * user never chose. The API keeps absolute paths — conversion is display-only.
 */

/** True when `path` is `root` itself or lives under it. */
function isUnderRoot(path: string, root: string): boolean {
  if (path === root) return true;
  if (!path.startsWith(root)) return false;
  const next = path.charAt(root.length);
  return next === '/' || next === '\\';
}

/** Absolute library path → root-relative display form ('/' is the root). */
export function displayPath(path: string, romsRoot: string | null): string {
  if (romsRoot === null || !isUnderRoot(path, romsRoot)) return path;
  return (
    '/' +
    path
      .slice(romsRoot.length)
      .replace(/^[\\/]+/, '')
      .replace(/\\/g, '/')
  );
}

/** Root-relative display form (as typed by the user) → absolute library path. */
export function absolutePath(display: string, romsRoot: string | null): string {
  if (romsRoot === null) return display;
  if (isUnderRoot(display, romsRoot)) return display; // pasted absolute path
  const sep = romsRoot.includes('\\') ? '\\' : '/';
  const parts = display.split(/[\\/]+/).filter(Boolean);
  if (parts.length === 0) return romsRoot;
  // Keep a trailing separator the user just typed: stripping it would make
  // the controlled input fight their keystroke.
  const trailing = /[\\/]$/.test(display) ? sep : '';
  return romsRoot + sep + parts.join(sep) + trailing;
}
