import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Each test file runs in its own fork (vitest default), so this gives every
// file a fresh SQLite database instead of polluting the real ~/.flemarr one.
process.env['FLEMARR_DATA_DIR'] = mkdtempSync(join(tmpdir(), 'flemarr-test-'));
