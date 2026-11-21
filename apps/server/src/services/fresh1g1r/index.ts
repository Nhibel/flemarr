import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import type { Fresh1g1rPreset, DatSourceEntry } from '@shared/fresh1g1r.js';
import type { DatSummary } from '@shared/dat.js';
import { parseDat, addDat, setDatOrigin } from '@/services/dat/index.js';
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

const githubTreeSchema = z.object({
  tree: z.array(
    z.object({
      path: z.string(),
      type: z.string(),
      sha: z.string(),
    }),
  ),
});

// GitHub's API occasionally gateway-times-out (502/503/504) on this repo —
// the Contents API response for a ~250-entry directory runs ~340KB (every
// entry repeats 5 full URLs), and at a 60s edge-cache window most requests
// recompute at origin. Retrying a couple of times absorbs that transient
// flakiness; see docs/archive-org-strategy.md for the same pattern against
// archive.org's own retryable statuses.
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const MAX_RETRIES = 2;

async function githubFetch(url: string, headers: Record<string, string>): Promise<Response> {
  let attempt = 0;
  for (;;) {
    const res = await fetch(url, { headers });
    if (res.ok || !RETRYABLE_STATUS.has(res.status) || attempt >= MAX_RETRIES) return res;
    await new Promise((r) => setTimeout(r, (attempt + 1) * 300));
    attempt++;
  }
}

function systemFromFilename(name: string): string {
  // Strip "(No-Intro - Fresh1G1R - PropeR).dat" / "(Redump - Fresh1G1R - PropeR).dat" suffix
  return name.replace(/\s+\([^)]*Fresh1G1R[^)]*\)\.dat$/i, '').trim();
}

export function rawUrl(path: string): string {
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

// The preset's own tree sha, from the small (~2KB) top-level listing — one
// recursive Trees API call scoped to it then replaces two heavy Contents API
// calls (no-intro + redump), at a fraction of the payload (see the retry
// comment above for why that matters).
async function getPresetTreeSha(
  preset: Fresh1g1rPreset,
  headers: Record<string, string>,
): Promise<string | null> {
  const res = await githubFetch(
    `https://api.github.com/repos/${REPO}/contents/daily-1g1r-dat`,
    headers,
  );
  if (!res.ok) {
    throw new Error(`GitHub API returned ${res.status} listing daily-1g1r-dat`);
  }
  const raw: unknown = await res.json();
  const parsed = githubContentsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('Unexpected GitHub API response shape');
  }
  return parsed.data.find((f) => f.name === preset && f.type === 'dir')?.sha ?? null;
}

export async function listDatSources(preset: Fresh1g1rPreset): Promise<DatSourceEntry[]> {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'flemarr/1.0',
  };

  const presetSha = await getPresetTreeSha(preset, headers);
  if (presetSha === null) return []; // preset folder absent, nothing to list

  const res = await githubFetch(
    `https://api.github.com/repos/${REPO}/git/trees/${presetSha}?recursive=1`,
    headers,
  );
  if (!res.ok) {
    throw new Error(`GitHub API returned ${res.status} for preset ${preset} tree`);
  }
  const raw: unknown = await res.json();
  const parsed = githubTreeSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('Unexpected GitHub API response shape');
  }

  const results: DatSourceEntry[] = parsed.data.tree
    .filter((e) => e.type === 'blob' && e.path.toLowerCase().endsWith('.dat'))
    .map((e) => {
      const name = e.path.slice(e.path.lastIndexOf('/') + 1);
      return {
        name,
        system: systemFromFilename(name),
        path: `daily-1g1r-dat/${preset}/${e.path}`,
        sha: e.sha,
      };
    });

  return results.sort((a, b) => a.system.localeCompare(b.system));
}

export async function fetchDat(
  preset: Fresh1g1rPreset,
  path: string,
  sha: string,
): Promise<DatSummary> {
  // Check disk cache first
  let content = await readCache(sha);

  if (content === null) {
    const res = await githubFetch(rawUrl(path), { 'User-Agent': 'flemarr/1.0' });
    if (!res.ok) {
      throw new Error(`Failed to download DAT: HTTP ${res.status}`);
    }
    content = await res.text();
    await writeCache(sha, content);
  }

  const dat = parseDat(content);
  const summary = addDat(dat);
  setDatOrigin(summary.id, preset, path);
  return summary;
}
