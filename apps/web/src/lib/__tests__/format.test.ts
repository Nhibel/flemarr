import { describe, it, expect } from 'vitest';
import { formatSize } from '../format.js';

describe('formatSize', () => {
  it('uses binary units with the decimal abbreviations', () => {
    expect(formatSize(1024)).toBe('1 KB');
    expect(formatSize(1_048_576)).toBe('1.0 MB');
    expect(formatSize(1_073_741_824)).toBe('1.0 GB');
  });

  it('keeps one decimal above a megabyte and none below', () => {
    expect(formatSize(524_288)).toBe('512 KB');
    expect(formatSize(4_404_019)).toBe('4.2 MB');
    expect(formatSize(3_650_722_201)).toBe('3.4 GB');
  });

  it('reports raw bytes under a kilobyte', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(1023)).toBe('1023 B');
  });

  // Each threshold is `>=`, so the exact boundary belongs to the larger
  // unit — "1024 B" would be a bug, not a rounding choice.
  it('switches unit exactly at each boundary', () => {
    expect(formatSize(1023)).toBe('1023 B');
    expect(formatSize(1024)).toBe('1 KB');
    expect(formatSize(1_048_575)).toBe('1024 KB');
    expect(formatSize(1_048_576)).toBe('1.0 MB');
  });
});
