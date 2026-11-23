import { AsyncLocalStorage } from 'node:async_hooks';

// Follows the async work a request starts, background jobs included: a scan
// or a download logs the id of the request that launched it.
const storage = new AsyncLocalStorage<{ requestId: string }>();

export function runWithRequestId<T>(requestId: string, task: () => T): T {
  return storage.run({ requestId }, task);
}

export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
