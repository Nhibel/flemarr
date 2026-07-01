// Extracts structured metadata from a DAT game name like:
// "Super Mario World (USA)" → { region: ['USA'], languages: [], category: 'Game' }
// "Final Fantasy VII (USA, Europe) (En,Fr,De) (Beta)" → { region: ['USA','Europe'], languages: ['En','Fr','De'], category: 'Beta' }

const REGION_TOKENS = new Set([
  'USA', 'Europe', 'Japan', 'World', 'Australia', 'Brazil', 'Canada',
  'China', 'France', 'Germany', 'Italy', 'Korea', 'Netherlands', 'Spain',
  'Sweden', 'Asia', 'Hong Kong', 'Taiwan', 'Russia', 'Poland', 'Denmark',
  'Finland', 'Norway', 'Portugal', 'Latin America',
]);

const LANGUAGE_RE = /^[A-Z][a-z](?:,[A-Z][a-z])*$/;

const CATEGORY_TOKENS: Record<string, string> = {
  Beta: 'Beta',
  Proto: 'Proto',
  Sample: 'Sample',
  Demo: 'Demo',
  Unl: 'Unl',
  Aftermarket: 'Aftermarket',
};

export interface ParsedName {
  region: string[];
  languages: string[];
  category: string;
}

export function parseName(name: string): ParsedName {
  const region: string[] = [];
  const languages: string[] = [];
  let category = 'Game';

  // Extract all parenthesised groups
  const groups = name.match(/\(([^)]+)\)/g) ?? [];

  for (const group of groups) {
    const inner = group.slice(1, -1);

    // Check for known category token
    if (inner in CATEGORY_TOKENS) {
      category = CATEGORY_TOKENS[inner] ?? 'Game';
      continue;
    }

    // Check for language list: "En,Fr,De"
    if (LANGUAGE_RE.test(inner)) {
      languages.push(...inner.split(','));
      continue;
    }

    // Check for region list (comma-separated, each token in REGION_TOKENS)
    const parts = inner.split(', ');
    if (parts.length > 0 && parts.every((p) => REGION_TOKENS.has(p))) {
      region.push(...parts);
      continue;
    }
  }

  return { region, languages, category };
}
