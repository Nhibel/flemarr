import { datUploadResponseSchema, gamesResponseSchema, errorResponseSchema } from '@shared/api.js';
import type { DatUploadResponse, GamesResponse } from '@shared/api.js';
import { scanJobSchema, renameResultSchema } from '@shared/scan.js';
import type { ScanJob, RenameRequest, RenameResult } from '@shared/scan.js';
import { downloadJobSchema, downloadEventSchema } from '@shared/download.js';
import type { DownloadRequest, DownloadEvent } from '@shared/download.js';
import { listSourcesResponseSchema, fetchDatResponseSchema } from '@shared/fresh1g1r.js';
import type { Fresh1g1rPreset, ListSourcesResponse, FetchDatRequest } from '@shared/fresh1g1r.js';
import {
  getSourcesResponseSchema,
  searchResponseSchema,
  indexResponseSchema,
  resolveResponseSchema,
} from '@shared/archive.js';
import type {
  ArchiveSource,
  ArchiveLayout,
  GetSourcesResponse,
  SearchResponse,
  IndexResponse,
  ResolveResponse,
} from '@shared/archive.js';

export type {
  ArchiveSource,
  ArchiveLayout,
  GetSourcesResponse,
  SearchResponse,
  IndexResponse,
  ResolveResponse,
  DownloadRequest,
  DownloadEvent,
  Fresh1g1rPreset,
  ListSourcesResponse,
};

async function parseResponse<T>(res: Response, schema: { parse(v: unknown): T }): Promise<T> {
  const json: unknown = await res.json();
  if (!res.ok) {
    const err = errorResponseSchema.safeParse(json);
    const message = err.success ? err.data.error.message : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return schema.parse(json);
}

export async function uploadDat(file: File): Promise<DatUploadResponse> {
  const content = await file.text();
  const res = await fetch('/api/dats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: content,
  });
  return parseResponse(res, datUploadResponseSchema);
}

export async function fetchGames(datId: string): Promise<GamesResponse['games']> {
  const res = await fetch(`/api/dats/${encodeURIComponent(datId)}/games`);
  return parseResponse(res, gamesResponseSchema).then((r) => r.games);
}

export async function startScan(datId: string, directory: string): Promise<ScanJob> {
  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ datId, directory }),
  });
  return parseResponse(res, scanJobSchema);
}

export function openScanEvents(jobId: string): EventSource {
  return new EventSource(`/api/scan/${encodeURIComponent(jobId)}/events`);
}

export async function requestRenames(renames: RenameRequest): Promise<RenameResult> {
  const res = await fetch('/api/scan/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(renames),
  });
  return parseResponse(res, renameResultSchema);
}

export async function fetchSources(system: string): Promise<GetSourcesResponse> {
  const res = await fetch(`/api/archive/sources?system=${encodeURIComponent(system)}`);
  return parseResponse(res, getSourcesResponseSchema);
}

export async function addSource(system: string, source: ArchiveSource): Promise<void> {
  const res = await fetch('/api/archive/sources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, source }),
  });
  await parseResponse(res, getSourcesResponseSchema.partial());
}

export async function deleteSource(identifier: string): Promise<void> {
  const res = await fetch(`/api/archive/sources/${encodeURIComponent(identifier)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const json: unknown = await res.json();
    const err = errorResponseSchema.safeParse(json);
    throw new Error(err.success ? err.data.error.message : `HTTP ${res.status}`);
  }
}

export async function searchArchive(q: string): Promise<SearchResponse> {
  const res = await fetch(`/api/archive/search?q=${encodeURIComponent(q)}`);
  return parseResponse(res, searchResponseSchema);
}

export async function previewIndex(identifier: string): Promise<IndexResponse> {
  const res = await fetch('/api/archive/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier }),
  });
  return parseResponse(res, indexResponseSchema);
}

export async function resolveGames(datId: string, gameIds: string[]): Promise<ResolveResponse> {
  const res = await fetch('/api/archive/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ datId, gameIds }),
  });
  return parseResponse(res, resolveResponseSchema);
}

export async function startDownload(request: DownloadRequest): Promise<string> {
  const res = await fetch('/api/downloads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return parseResponse(res, downloadJobSchema).then((j) => j.jobId);
}

export function openDownloadEvents(jobId: string): EventSource {
  return new EventSource(`/api/downloads/${encodeURIComponent(jobId)}/events`);
}

export async function cancelDownload(jobId: string): Promise<void> {
  await fetch(`/api/downloads/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' });
}

// Re-export schema for use in components
export { downloadEventSchema };

export async function listDatSources(preset: Fresh1g1rPreset): Promise<ListSourcesResponse> {
  const res = await fetch(`/api/dat-sources?preset=${encodeURIComponent(preset)}`);
  return parseResponse(res, listSourcesResponseSchema);
}

export async function fetchDatFromFresh1g1r(request: FetchDatRequest): Promise<DatUploadResponse> {
  const res = await fetch('/api/dats/from-fresh1g1r', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return parseResponse(res, fetchDatResponseSchema);
}
