/**
 * French plural of a word for a count: "jeu" → "jeux" from 2 on. French
 * keeps 0 and 1 singular ("0 fichier", "1 fichier", "2 fichiers"), which is
 * why this isn't `count !== 1`. The regular "+s" form is the default; pass
 * the irregular one ("jeux") explicitly.
 */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count > 1 ? pluralForm : singular;
}
