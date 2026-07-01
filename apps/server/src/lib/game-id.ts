import { createHash } from 'node:crypto';

export function makeGameId(name: string, firstRomCrc: string): string {
  return createHash('sha1').update(`${name}:${firstRomCrc}`).digest('hex').slice(0, 16);
}
