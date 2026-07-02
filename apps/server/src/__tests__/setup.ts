import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Each test file runs in its own fork (vitest default), so this gives every
// file a fresh SQLite database instead of polluting the real ~/.rom-curator one.
process.env['ROM_CURATOR_DATA_DIR'] = mkdtempSync(join(tmpdir(), 'rom-curator-test-'));
