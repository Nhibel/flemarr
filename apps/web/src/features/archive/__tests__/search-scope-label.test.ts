import { describe, expect, it } from 'vitest';
import { searchScopeLabel } from '../search-scope-label.js';

describe('searchScopeLabel', () => {
  it('says every source is searched while none is ticked', () => {
    expect(searchScopeLabel(0, 6)).toMatch(/toutes les sources/);
  });

  it('counts the ticked sources', () => {
    expect(searchScopeLabel(1, 6)).toBe('La recherche portera sur 1 source sur 6.');
    expect(searchScopeLabel(2, 6)).toBe('La recherche portera sur 2 sources sur 6.');
  });
});
