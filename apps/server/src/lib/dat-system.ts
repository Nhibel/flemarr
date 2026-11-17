/**
 * A DAT header's system name carries tags the upstream art repositories do
 * not use: Retool appends "(Retool)", Fresh1G1R appends its preset, and some
 * DATs carry a build date. Stripping the trailing parenthesized groups leaves
 * the plain "Vendor - System" form that both libretro-thumbnails and
 * retroarch-assets name their directories and files after.
 *
 * Only *trailing* groups go: "NEC - PC Engine (CD) Something" keeps its
 * parentheses, because they are part of the name rather than a tag.
 */
export function stripDatSystemTags(datSystem: string): string {
  let name = datSystem.trim();
  for (;;) {
    const stripped = name.replace(/\s*\([^)]*\)$/, '').trim();
    if (stripped === name || stripped === '') break;
    name = stripped;
  }
  return name === '' ? datSystem.trim() : name;
}
