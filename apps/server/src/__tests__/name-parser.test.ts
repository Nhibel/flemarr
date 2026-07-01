import { describe, it, expect } from 'vitest';
import { parseName } from '../services/dat/name-parser.js';

describe('parseName', () => {
  it('extracts USA region', () => {
    expect(parseName('Super Mario World (USA)')).toMatchObject({
      region: ['USA'],
      languages: [],
      category: 'Game',
    });
  });

  it('extracts Europe region', () => {
    expect(parseName('Sonic the Hedgehog (Europe)')).toMatchObject({
      region: ['Europe'],
      languages: [],
      category: 'Game',
    });
  });

  it('extracts multiple regions', () => {
    expect(parseName('Tetris (USA, Europe)')).toMatchObject({
      region: ['USA', 'Europe'],
    });
  });

  it('extracts World region', () => {
    expect(parseName('Some Game (World)')).toMatchObject({
      region: ['World'],
    });
  });

  it('extracts languages', () => {
    expect(parseName('Final Fantasy VI (USA) (En,Es)')).toMatchObject({
      languages: ['En', 'Es'],
    });
  });

  it('extracts Beta category', () => {
    expect(parseName('Some Game (USA) (Beta)')).toMatchObject({
      category: 'Beta',
    });
  });

  it('extracts Proto category', () => {
    expect(parseName('Some Game (Japan) (Proto)')).toMatchObject({
      category: 'Proto',
    });
  });

  it('extracts Demo category', () => {
    expect(parseName('Some Game (USA) (Demo)')).toMatchObject({
      category: 'Demo',
    });
  });

  it('extracts Unl category', () => {
    expect(parseName('Some Game (USA) (Unl)')).toMatchObject({
      category: 'Unl',
    });
  });

  it('defaults to Game category when no special tag', () => {
    expect(parseName('Generic Game (USA)')).toMatchObject({ category: 'Game' });
  });

  it('handles no parentheses', () => {
    expect(parseName('No Parens Game')).toMatchObject({
      region: [],
      languages: [],
      category: 'Game',
    });
  });

  it('handles region + language + category together', () => {
    expect(parseName('Game (USA, Europe) (En,Fr,De) (Beta)')).toMatchObject({
      region: ['USA', 'Europe'],
      languages: ['En', 'Fr', 'De'],
      category: 'Beta',
    });
  });
});
