import { z } from 'zod';
import type { SearchResult } from '@shared/archive.js';
import { logger } from '@/lib/logger.js';

const searchSchema = z.object({
  response: z.object({
    docs: z.array(
      z.object({
        identifier: z.string(),
        // archive.org sometimes returns titles/descriptions as arrays
        title: z.union([z.string(), z.array(z.string())]).optional(),
        description: z.union([z.string(), z.array(z.string())]).optional(),
        item_size: z.coerce.number().optional(),
      }),
    ),
  }),
});

/** Full-text search on archive.org, most-downloaded items first. */
export async function searchArchive(query: string, rows = 20): Promise<SearchResult[]> {
  const url =
    `https://archive.org/advancedsearch.php?` +
    `q=${encodeURIComponent(query)}&output=json&rows=${rows}` +
    `&fl[]=identifier&fl[]=title&fl[]=description&fl[]=item_size` +
    `&sort[]=downloads+desc`;

  const start = Date.now();
  const res = await fetch(url);
  if (!res.ok) {
    logger.warn({ query, status: res.status }, 'archive search failed');
    throw new Error(`archive.org search returned ${res.status}`);
  }

  const raw: unknown = await res.json();
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn({ query, issues: parsed.error.issues.slice(0, 3) }, 'unexpected search shape');
    throw new Error('Unexpected search response shape');
  }

  const results = parsed.data.response.docs.map((d) => ({
    identifier: d.identifier,
    title: (Array.isArray(d.title) ? d.title[0] : d.title) ?? d.identifier,
    description: (Array.isArray(d.description) ? d.description[0] : d.description) ?? '',
    itemSize: d.item_size,
  }));
  logger.info({ query, results: results.length, ms: Date.now() - start }, 'archive search');
  return results;
}
