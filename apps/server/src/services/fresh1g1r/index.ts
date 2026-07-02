import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import type { Fresh1g1rPreset, DatSourceEntry } from '@shared/fresh1g1r.js';
import type { DatSummary } from '@shared/dat.js';
import { parseDat, addDat } from '@/services/dat/index.js';
import { dataDir } from '@/lib/db.js';

const REPO = 'UnluckyForSome/Fresh1G1R';
const BRANCH = 'main';

function cacheDir(): string {
  return join(dataDir(), 'cache');
}

const githubFileSchema = z.object({
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  type: z.string(),
});

const githubContentsSchema = z.array(githubFileSchema);

function systemFromFilename(name: string): string {
  // Strip "(No-Intro - Fresh1G1R - PropeR).dat" / "(Redump - Fresh1G1R - PropeR).dat" suffix
  return name.replace(/\s+\([^)]*Fresh1G1R[^)]*\)\.dat$/i, '').trim();
}

function rawUrl(path: string): string {
  return `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${encodeURI(path)}`;
}

async function readCache(sha: string): Promise<string | null> {
  try {
    const content = await readFile(join(cacheDir(), `${sha}.dat`), 'utf8');
    return content;
  } catch {
    return null;
  }
}

async function writeCache(sha: string, content: string): Promise<void> {
  await mkdir(cacheDir(), { recursive: true });
  await writeFile(join(cacheDir(), `${sha}.dat`), content, 'utf8');
}

export async function listDatSources(preset: Fresh1g1rPreset): Promise<DatSourceEntry[]> {
  const base = `https://api.github.com/repos/${REPO}/contents/daily-1g1r-dat/${encodeURIComponent(preset)}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'rom-curator/1.0',
  };

  const [noIntroRes, redumpRes] = await Promise.all([
    fetch(`${base}/no-intro`, { headers }),
    fetch(`${base}/redump`, { headers }),
  ]);

  const results: DatSourceEntry[] = [];

  for (const [res, subdir] of [
    [noIntroRes, 'no-intro'],
    [redumpRes, 'redump'],
  ] as const) {
    if (!res.ok) {
      if (res.status === 404) continue; // subdir absent for this preset, skip
      throw new Error(`GitHub API returned ${res.status} for preset ${preset}/${subdir}`);
    }
    const raw: unknown = await res.json();
    const parsed = githubContentsSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error('Unexpected GitHub API response shape');
    }
    results.push(
      ...parsed.data
        .filter((f) => f.type === 'file' && f.name.toLowerCase().endsWith('.dat'))
        .map((f) => ({
          name: f.name,
          system: systemFromFilename(f.name),
          path: f.path,
          sha: f.sha,
        })),
    );
  }

  return results.sort((a, b) => a.system.localeCompare(b.system));
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
