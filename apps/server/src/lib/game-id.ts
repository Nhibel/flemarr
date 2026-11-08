import { createHash } from 'node:crypto';

// firstRomCrc is undefined for a nodump first ROM — hashed as an empty
// string rather than requiring a value that doesn't exist.
export function makeGameId(name: string, firstRomCrc: string | undefined): string {
  return createHash('sha1')
    .update(`${name}:${firstRomCrc ?? ''}`)
    .digest('hex')
    .slice(0, 16);
}
