import { z } from 'zod';
import type { SearchResult } from '@shared/archive.js';

const searchSchema = z.object({
  response: z.object({
    docs: z.array(
      z.object({
        identifier: z.string(),
        title: z.string().optional(),
        // archive.org sometimes returns titles/descriptions as arrays
        description: z.union([z.string(), z.array(z.string())]).optional(),
        item_size: z.number().optional(),
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

  const res = await fetch(url);
  if (!res.ok) throw new Error(`archive.org search returned ${res.status}`);

  const raw: unknown = await res.json();
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Unexpected search response shape');

  return parsed.data.response.docs.map((d) => ({
    identifier: d.identifier,
    title: d.title ?? d.identifier,
    description: Array.isArray(d.description) ? (d.description[0] ?? '') : (d.description ?? ''),
    itemSize: d.item_size,
  }));
}
