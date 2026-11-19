import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { downloadFile } from './worker.js';
import type { DownloadJobState } from './job-store.js';

// Resolves once the signal aborts — used to race a per-item cancel against
// the archive-container fast path's own operations (in processItem), neither of which
// otherwise ever check this item's signal mid-flight: getOrFetchContainer
// deliberately uses the job's signal, not this item's own, since the fetch
// may still be needed by sibling roms; extractContainerEntry takes no
// signal at all. Without this, cancelling one item that's waiting on (or
// extracting from) an archive-container had no effect at all until that
// operation finished on its own.
export function abortSignal(signal: AbortSignal): Promise<'aborted'> {
  if (signal.aborted) return Promise.resolve('aborted');
  return new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve('aborted'), { once: true });
  });
}

// A container shared by several roms (see getOrFetchContainer) is job-scoped,
// not any single item's own tempPath — cleaned up once, here, rather than
// refcounted per item. By the time this runs (after every item has settled),
// any container still fetching has already had its last claim released,
// which aborts it — so this mostly awaits already-aborted/finished fetches,
// not a full in-progress download.
export async function cleanupContainerCache(job: DownloadJobState): Promise<void> {
  const settled = await Promise.allSettled(
    [...job.containerCache.values()].map((entry) => entry.promise),
  );
  await Promise.all(
    settled
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map((r) => rm(r.value, { force: true }).catch(() => undefined)),
  );
}

// Fetches a whole archive container once per job, sharing it across every
// rom that needs an entry from it (e.g. a disc's .bin and .cue in the same
// per-game .7z). The check-then-set on containerCache is synchronous — no
// `await` in between — so concurrent callers for the same URL never race
// into two fetches.
//
// A per-game archive can be hundreds of MB — every item waiting on this
// same fetch registers its own onProgress as a listener, so every one of
// them (not just whichever item happened to trigger the fetch) sees real
// progress while the shared container downloads, instead of nothing at all
// until it's done (which looked exactly like the download never started).
//
// Returns a `release()` the caller must call (in a finally) once it's done
// with the container either way. refCount tracks how many items still
// claim it; once it hits zero the fetch is aborted if still running —
// without this, cancelling every item sharing a container left the real
// download running to completion in the background regardless, which also
// blocked the job from ever finishing (cleanupContainerCache awaits it at
// job end): the job-level "Annuler" button stayed up long after every row
// it was for had already disappeared. The container's own controller still
// cascades from the job's signal (whole-job cancel keeps working), but
// cancelling one item must not aim it at siblings still using the same
// container — only at this item's own claim.
export function getOrFetchContainer(
  job: DownloadJobState,
  containerUrl: string,
  jobSignal: AbortSignal,
  stagingDir: string,
  onProgress: (bytesDownloaded: number, totalBytes: number) => void,
): { promise: Promise<string>; release: () => void } {
  let entry = job.containerCache.get(containerUrl);
  if (!entry) {
    const controller = new AbortController();
    if (jobSignal.aborted) controller.abort();
    else jobSignal.addEventListener('abort', () => controller.abort(), { once: true });

    const containerPath = join(stagingDir, `${randomUUID()}-container`);
    const listeners = new Set([onProgress]);
    const promise = downloadFile({
      url: containerUrl,
      tempPath: containerPath,
      signal: controller.signal,
      onProgress: (bytesDownloaded, totalBytes) => {
        for (const listener of listeners) listener(bytesDownloaded, totalBytes);
      },
    }).then((result) => {
      if (result !== 'done') throw new Error(`container fetch failed: ${result}`);
      return containerPath;
    });
    entry = { promise, listeners, controller, refCount: 0 };
    job.containerCache.set(containerUrl, entry);
  } else {
    entry.listeners.add(onProgress);
  }

  const activeEntry = entry;
  activeEntry.refCount++;
  let released = false;
  return {
    promise: activeEntry.promise,
    release: () => {
      if (released) return;
      released = true;
      activeEntry.listeners.delete(onProgress);
      activeEntry.refCount--;
      if (activeEntry.refCount <= 0) activeEntry.controller.abort();
    },
  };
}
