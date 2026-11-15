/**
 * A byte count for display, in binary units.
 *
 * Was copy-pasted identically into three components (the game row, the
 * selection dock, the download manager), which is how the same number came
 * to be formatted the same way by accident rather than by design. One
 * implementation means one place to change if the unit style ever should.
 *
 * Binary units labelled with the decimal abbreviations (KB/MB/GB rather
 * than KiB/MiB/GiB) on purpose: that is what the DAT sources, archive.org
 * and every emulator frontend show, so matching them avoids a game looking
 * like a different size here than everywhere else the user sees it.
 *
 * One decimal above a megabyte, none below: a ROM measured to a tenth of a
 * kilobyte is noise, and these are read down a long list where a varying
 * number of digits is what makes a column look crooked.
 */
export function formatSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}
