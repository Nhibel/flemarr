import { css } from '@/styled-system/css';

/**
 * The status lines above the resolve results: what blocks a resolve or a
 * download, and the last error. Several can show at once.
 */
export function ResolveNotices({
  hasSources,
  selectedCount,
  toResolveCount,
  hasNoFolder,
  isStale,
  error,
}: {
  hasSources: boolean;
  /** Games selected in the Jeux tab. */
  selectedCount: number;
  /** Games that would be resolved — the selection minus owned games when excluded. */
  toResolveCount: number;
  hasNoFolder: boolean;
  isStale: boolean;
  error: string | null;
}) {
  const hasSelection = selectedCount > 0;
  const needsSelection = hasSources && !hasSelection;
  const allSelectedOwned = hasSources && hasSelection && toResolveCount === 0;

  return (
    <>
      {!hasSources && (
        <p className={css({ fontSize: 'sm', color: 'status.warning.text' })}>
          Ajoute au moins une source ci-dessus avant de lancer la résolution.
        </p>
      )}

      {needsSelection && (
        <p className={css({ fontSize: 'sm', color: 'fg.faint' })}>
          Sélectionne des jeux dans l'onglet Jeux pour lancer la résolution.
        </p>
      )}

      {allSelectedOwned && (
        <p className={css({ fontSize: 'sm', color: 'status.success.text' })}>
          Tous les jeux sélectionnés sont déjà présents sur le disque — rien à télécharger.
        </p>
      )}

      {hasNoFolder && (
        <p className={css({ fontSize: 'sm', color: 'status.warning.text' })}>
          Aucun dossier défini pour ce système : les téléchargements seront refusés. Choisis-le dans
          le bandeau en haut de page.
        </p>
      )}

      {error && (
        <p role="alert" className={css({ fontSize: 'sm', color: 'status.danger.text' })}>
          {error}
        </p>
      )}

      {isStale && (
        <p className={css({ fontSize: 'sm', color: 'status.warning.text', mb: '3' })}>
          Les sources ont changé depuis cette résolution : relance la recherche avant de
          télécharger.
        </p>
      )}
    </>
  );
}
