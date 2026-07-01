import { datUploadResponseSchema, gamesResponseSchema, errorResponseSchema } from '@shared/api.js';
import type { DatUploadResponse, GamesResponse } from '@shared/api.js';
import { scanJobSchema, renameResultSchema } from '@shared/scan.js';
import type { ScanJob, RenameRequest, RenameResult } from '@shared/scan.js';

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
