import { describe, expect, it } from 'vitest';
import { plural } from '../plural.js';

describe('plural', () => {
  it('keeps 0 and 1 singular, as French does', () => {
    expect(plural(0, 'fichier')).toBe('fichier');
    expect(plural(1, 'fichier')).toBe('fichier');
  });

  it('adds an s from 2 on', () => {
    expect(plural(2, 'fichier')).toBe('fichiers');
  });

  it('takes an irregular plural', () => {
    expect(plural(3, 'jeu', 'jeux')).toBe('jeux');
    expect(plural(1, 'jeu', 'jeux')).toBe('jeu');
  });
});
