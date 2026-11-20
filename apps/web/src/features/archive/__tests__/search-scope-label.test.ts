import { describe, expect, it } from 'vitest';
import { searchScopeLabel } from '../search-scope-label.js';

describe('searchScopeLabel', () => {
  it('says every source is searched while all are on', () => {
    expect(searchScopeLabel(6, 6)).toBe('La recherche portera sur toutes les sources.');
  });

  it('counts the sources still on', () => {
    expect(searchScopeLabel(1, 6)).toBe('La recherche portera sur 1 source sur 6.');
    expect(searchScopeLabel(2, 6)).toBe('La recherche portera sur 2 sources sur 6.');
  });

  it('says nothing can be searched with every source off', () => {
    expect(searchScopeLabel(0, 6)).toMatch(/Aucune source active/);
  });
});
