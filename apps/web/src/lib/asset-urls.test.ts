import { describe, expect, it } from 'vitest';
import { gameBoxartUrl, systemIconUrl } from './asset-urls.js';

describe('asset URLs', () => {
  it('encodes ids that hold path characters', () => {
    expect(gameBoxartUrl('dat/1', 'Game (USA) #2')).toBe(
      '/api/dats/dat%2F1/games/Game%20(USA)%20%232/boxart',
    );
  });

  it('passes the system name as a query parameter', () => {
    expect(systemIconUrl('Sony - PlayStation')).toBe(
      '/api/systems/icon?system=Sony%20-%20PlayStation',
    );
  });
});
