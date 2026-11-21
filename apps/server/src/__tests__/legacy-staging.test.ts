import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeLegacyStagingDirs } from '@/services/downloader/legacy-staging.js';

describe('removeLegacyStagingDirs', () => {
  const library = mkdtempSync(join(tmpdir(), 'flemarr-legacy-staging-test-'));
  afterEach(() => rmSync(library, { recursive: true, force: true }));

  it('removes the pre-rename staging dir from the library folder and the OS temp dir', async () => {
    const libraryStaging = join(library, '.rom-curator-tmp');
    const browserStaging = join(tmpdir(), 'rom-curator-browser-dl');
    mkdirSync(libraryStaging, { recursive: true });
    mkdirSync(browserStaging, { recursive: true });
    writeFileSync(join(libraryStaging, 'job-Game (USA).sfc'), 'partial');

    await removeLegacyStagingDirs(library);

    expect(existsSync(libraryStaging)).toBe(false);
    expect(existsSync(browserStaging)).toBe(false);
    expect(existsSync(library)).toBe(true);
  });

  it('is a no-op when nothing is left over', async () => {
    await expect(removeLegacyStagingDirs(undefined)).resolves.toBeUndefined();
  });
});
