import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import type { Fresh1g1rPreset, DatSourceEntry } from '@shared/fresh1g1r.js';
import type { DatSummary } from '@shared/dat.js';
import { parseDat, addDat } from '@/services/dat/index.js';

const REPO = 'UnluckyForSome/Fresh1G1R';
const BRANCH = 'main';
const CACHE_DIR = join(homedir(), '.rom-curator', 'cache');

const githubFileSchema = z.object({
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  type: z.string(),
});

const githubContentsSchema = z.array(githubFileSchema);

function systemFromFilename(name: string): string {
  return name.replace(/\.dat$/i, '');
}

function rawUrl(path: string): string {
  return `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${encodeURI(path)}`;
}

async function ensureCacheDir(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
}

async function readCache(sha: string): Promise<string | null> {
  try {
    const content = await readFile(join(CACHE_DIR, `${sha}.dat`), 'utf8');
    return content;
  } catch {
    return null;
  }
}

async function writeCache(sha: string, content: string): Promise<void> {
  await ensureCacheDir();
  await writeFile(join(CACHE_DIR, `${sha}.dat`), content, 'utf8');
}

export async function listDatSources(preset: Fresh1g1rPreset): Promise<DatSourceEntry[]> {
  const url = `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(preset)}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'rom-curator/1.0',
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API returned ${res.status} for preset ${preset}`);
  }

  const raw: unknown = await res.json();
  const parsed = githubContentsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('Unexpected GitHub API response shape');
  }

  return parsed.data
    .filter((f) => f.type === 'file' && f.name.toLowerCase().endsWith('.dat'))
    .map((f) => ({
      name: f.name,
      system: systemFromFilename(f.name),
      path: f.path,
      sha: f.sha,
    }));
}

export async function fetchDat(
  _preset: Fresh1g1rPreset,
  path: string,
  sha: string,
): Promise<DatSummary> {
  // Check disk cache first
  let content = await readCache(sha);

  if (content === null) {
    const res = await fetch(rawUrl(path), {
      headers: { 'User-Agent': 'rom-curator/1.0' },
    });
    if (!res.ok) {
      throw new Error(`Failed to download DAT: HTTP ${res.status}`);
    }
    content = await res.text();
    await writeCache(sha, content);
  }

  const dat = parseDat(content);
  return addDat(dat);
}
