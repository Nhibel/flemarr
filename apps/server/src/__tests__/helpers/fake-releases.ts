import { vi } from 'vitest';
import { zipSync, strToU8 } from 'fflate';

export interface FakeReleases {
  tag: string;
  /** Asset name → its ZIP bytes. */
  assets: Record<string, Uint8Array>;
  /** Statuses answered to the next requests, before anything else. */
  failures: number[];
  /** Answers 200 and the whole file to a Range request. */
  ignoreRange: boolean;
  /** Releases that no longer exist upstream. */
  goneTags: string[];
}

export function zipOf(files: Record<string, string>): Uint8Array {
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])),
  );
}

function rangeResponse(bytes: Uint8Array, range: string): Response {
  const bounds = /^bytes=(\d+)-(\d+)$/.exec(range);
  // Like GitHub's storage, which refuses suffix ranges (bytes=-N).
  if (bounds === null) return new Response(null, { status: 501 });
  const part = bytes.slice(Number(bounds[1]), Number(bounds[2]) + 1);
  return new Response(part, { status: 206 });
}

function assetResponse(
  bytes: Uint8Array,
  init: RequestInit | undefined,
  ignoreRange: boolean,
): Response {
  if (init?.method === 'HEAD') {
    return new Response(null, { headers: { 'content-length': String(bytes.length) } });
  }
  const range = new Headers(init?.headers).get('range');
  if (range === null || ignoreRange) return new Response(bytes.slice());
  return rangeResponse(bytes, range);
}

const BASE = 'https://github.com/UnluckyForSome/Fresh1G1R/releases';

/** Stubs fetch with GitHub's release downloads. Mutate the result to change them. */
export function stubReleases(initial: Partial<FakeReleases> = {}) {
  const releases: FakeReleases = {
    tag: 'daily-1',
    assets: {},
    failures: [],
    ignoreRange: false,
    goneTags: [],
    ...initial,
  };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
    const failure = releases.failures.shift();
    if (failure !== undefined) return new Response(null, { status: failure });

    const asset = url.slice(url.lastIndexOf('/') + 1);
    const bytes = releases.assets[asset];
    if (url.startsWith(`${BASE}/latest/download/`)) {
      const location = `${BASE}/download/${releases.tag}/${asset}`;
      return new Response(null, { status: 302, headers: { location } });
    }
    const tag = url.split('/').at(-2) ?? '';
    const isGone = bytes === undefined || releases.goneTags.includes(tag);
    if (isGone) return new Response(null, { status: 404 });
    return assetResponse(bytes, init, releases.ignoreRange);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { releases, fetchMock };
}
