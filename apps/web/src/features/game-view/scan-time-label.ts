/**
 * When the last scan ran, for the header. The scan is kept server-side, so
 * it can be days old: the time alone is enough today, any other day also
 * names the date.
 */
export function scanTimeLabel(scannedAt: Date, now: Date = new Date()): string {
  const time = scannedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isToday = scannedAt.toDateString() === now.toDateString();
  if (isToday) return `vérifié à ${time}`;
  const date = scannedAt.toLocaleDateString([], { day: 'numeric', month: 'short' });
  return `vérifié le ${date} à ${time}`;
}
