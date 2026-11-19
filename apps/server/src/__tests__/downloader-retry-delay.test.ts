import { describe, expect, it } from 'vitest';
import { retryDelaySeconds } from '../services/downloader/worker.js';

describe('retryDelaySeconds', () => {
  it("follows the server's Retry-After", () => {
    expect(retryDelaySeconds('12', 0)).toBe(12);
  });

  it('caps a long Retry-After at 30 seconds', () => {
    expect(retryDelaySeconds('3600', 0)).toBe(30);
  });

  it('backs off linearly without a Retry-After', () => {
    expect(retryDelaySeconds(null, 0)).toBe(5);
    expect(retryDelaySeconds(null, 1)).toBe(10);
  });

  it('ignores a Retry-After that is an HTTP date', () => {
    expect(retryDelaySeconds('Wed, 21 Oct 2026 07:28:00 GMT', 1)).toBe(10);
  });
});
