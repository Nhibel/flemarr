import { listDirsResponseSchema, createDirResponseSchema } from '@shared/fs.js';
import type { ListDirsResponse, CreateDirResponse } from '@shared/fs.js';
import {
  datUploadResponseSchema,
  gamesResponseSchema,
  listDatsResponseSchema,
  errorResponseSchema,
} from '@shared/api.js';
import type { DatUploadResponse, GamesResponse, ListDatsResponse } from '@shared/api.js';
import { scanJobSchema, renameResultSchema, lastScanResponseSchema } from '@shared/scan.js';
import type { ScanJob, RenameRequest, RenameResult, LastScan } from '@shared/scan.js';
import { downloadJobSchema, downloadEventSchema } from '@shared/download.js';
import type { DownloadRequest, DownloadEvent } from '@shared/download.js';
import { listSourcesResponseSchema, fetchDatResponseSchema } from '@shared/fresh1g1r.js';
import type { Fresh1g1rPreset, ListSourcesResponse, FetchDatRequest } from '@shared/fresh1g1r.js';
import { settingsResponseSchema } from '@shared/settings.js';
import type { SettingsResponse, UpdateSettings } from '@shared/settings.js';
import { gameDetailsResponseSchema } from '@shared/game-details.js';
import type { GameDetailsResponse } from '@shared/game-details.js';
import { systemIconsResponseSchema } from '@shared/system-icon.js';
import type { SystemIconsResponse } from '@shared/system-icon.js';
import {
  getSourcesResponseSchema,
  searchResponseSchema,
  indexResponseSchema,
  resolveResponseSchema,
  suggestResponseSchema,
} from '@shared/archive.js';
import type {
  ArchiveSource,
  ArchiveLayout,
  GetSourcesResponse,
  SearchResponse,
  IndexResponse,
  ResolveResponse,
  SuggestResponse,
} from '@shared/archive.js';

export type {
  ArchiveSource,
  ArchiveLayout,
  GetSourcesResponse,
  SearchResponse,
  IndexResponse,
  ResolveResponse,
  SuggestResponse,
  DownloadRequest,
  DownloadEvent,
  Fresh1g1rPreset,
  ListSourcesResponse,
};

/** Throws the server error-envelope message (or `HTTP <status>`) on non-2xx responses. */
async function ensureOk(res: Response): Promise<void> {
  if (res.ok) return;
  const json: unknown = await res.json().catch(() => undefined);
  const err = errorResponseSchema.safeParse(json);
  throw new Error(err.success ? err.data.error.message : `HTTP ${res.status}`);
}

async function parseResponse<T>(res: Response, schema: { parse(v: unknown): T }): Promise<T> {
  await ensureOk(res);
  return schema.parse(await res.json());
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

export async function listDats(): Promise<ListDatsResponse['dats']> {
  const res = await fetch('/api/dats');
  return parseResponse(res, listDatsResponseSchema).then((r) => r.dats);
}

export async function deleteDat(datId: string): Promise<void> {
  const res = await fetch(`/api/dats/${encodeURIComponent(datId)}`, { method: 'DELETE' });
  await ensureOk(res);
}

/** The DAT's last finished scan, null when it was never scanned. */
export async function fetchLastScan(datId: string): Promise<LastScan | null> {
  const res = await fetch(`/api/dats/${encodeURIComponent(datId)}/last-scan`);
  return parseResponse(res, lastScanResponseSchema).then((r) => r.lastScan);
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
  await ensureOk(res);
}

// The system scopes the deletion: one identifier can serve several systems.
/** Switches a source on or off for resolves; the choice is stored server-side. */
export async function setSourceSearched(
  identifier: string,
  system: string,
  searched: boolean,
): Promise<void> {
  const res = await fetch(`/api/archive/sources/${encodeURIComponent(identifier)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, searched }),
  });
  await ensureOk(res);
}

export async function deleteSource(identifier: string, system: string): Promise<void> {
  const res = await fetch(
    `/api/archive/sources/${encodeURIComponent(identifier)}?system=${encodeURIComponent(system)}`,
    { method: 'DELETE' },
  );
  await ensureOk(res);
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

export async function archiveLogin(email: string, password: string): Promise<void> {
  const res = await fetch('/api/archive/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  await ensureOk(res);
}

export async function suggestSources(datId: string): Promise<SuggestResponse> {
  const res = await fetch('/api/archive/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ datId }),
  });
  return parseResponse(res, suggestResponseSchema);
}

/** Searches the system's sources that are switched on. */
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
  const res = await fetch(`/api/downloads/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
  });
  await ensureOk(res);
}

export async function cancelDownloadItem(
  jobId: string,
  gameId: string,
  romName: string,
): Promise<void> {
  const res = await fetch(
    `/api/downloads/${encodeURIComponent(jobId)}/items/${encodeURIComponent(gameId)}/${encodeURIComponent(romName)}/cancel`,
    { method: 'POST' },
  );
  await ensureOk(res);
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

export async function getSettings(): Promise<SettingsResponse> {
  const res = await fetch('/api/settings');
  return parseResponse(res, settingsResponseSchema);
}

export async function updateSettings(patch: UpdateSettings): Promise<SettingsResponse> {
  const res = await fetch('/api/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return parseResponse(res, settingsResponseSchema);
}

export type { SettingsResponse, UpdateSettings };

export async function validateDir(
  path: string,
): Promise<{ exists: boolean; isDirectory: boolean }> {
  const res = await fetch('/api/fs/validate-dir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  await ensureOk(res);
  return res.json() as Promise<{ exists: boolean; isDirectory: boolean }>;
}

export async function listDirs(path: string): Promise<ListDirsResponse> {
  const res = await fetch(`/api/fs/list-dirs?path=${encodeURIComponent(path)}`);
  if (!res.ok) return { listedPath: '', parent: null, dirs: [], fileCount: 0 };
  return listDirsResponseSchema.parse(await res.json());
}

export async function createDir(path: string): Promise<CreateDirResponse> {
  const res = await fetch('/api/fs/create-dir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  return parseResponse(res, createDirResponseSchema);
}

export async function fetchGameDetails(
  datId: string,
  gameIds: string[],
): Promise<GameDetailsResponse> {
  const res = await fetch(`/api/dats/${encodeURIComponent(datId)}/games/details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameIds }),
  });
  return parseResponse(res, gameDetailsResponseSchema);
}

export async function fetchSystemIcons(systems: string[]): Promise<SystemIconsResponse> {
  const res = await fetch('/api/systems/icons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systems }),
  });
  return parseResponse(res, systemIconsResponseSchema);
}

export type { ListDirsResponse, CreateDirResponse };
