import { describe, it, expect } from 'vitest';
import { scanTimeLabel } from '../scan-time-label.js';

const NOW = new Date(2026, 10, 21, 18, 0);

describe('scanTimeLabel', () => {
  it('gives only the time for a scan run today', () => {
    const at = new Date(2026, 10, 21, 9, 5);
    const time = at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    expect(scanTimeLabel(at, NOW)).toBe(`vérifié à ${time}`);
  });

  it('names the date of an older scan', () => {
    const at = new Date(2026, 10, 19, 14, 30);
    const date = at.toLocaleDateString([], { day: 'numeric', month: 'short' });
    expect(scanTimeLabel(at, NOW)).toContain(`vérifié le ${date} à `);
  });
});
