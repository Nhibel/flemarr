import { describe, expect, it } from 'vitest';
import { failureReason } from '../services/downloader/process-item.js';

describe('failureReason', () => {
  it('names a CRC mismatch, whatever error came before it', () => {
    expect(failureReason('crc-mismatch', 'HTTP 503')).toBe('CRC mismatch');
  });

  it('quotes the last source error', () => {
    expect(failureReason('exhausted', 'HTTP 404')).toBe('Download failed (HTTP 404)');
  });

  it('stays generic without an error message', () => {
    expect(failureReason('exhausted', '')).toBe('Download failed');
  });
});
