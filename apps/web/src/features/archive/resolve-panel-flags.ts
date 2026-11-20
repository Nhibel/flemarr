import type { DownloadTarget } from '@shared/download.js';

export interface ResolvePanelFlagsInput {
  sourceCount: number;
  /** Configured sources switched on in the source list. */
  activeSourceCount: number;
  /** The source key the shown results were resolved against; null before any resolve. */
  resolvedSourceKey: string | null;
  currentSourceKey: string;
  downloadTarget: DownloadTarget;
  /** '' while settings load or when no folder is set for the system. */
  destinationDir: string;
  settingsLoaded: boolean;
  toResolveCount: number;
  resolving: boolean;
  queuing: boolean;
}

export interface ResolvePanelFlags {
  hasSources: boolean;
  /** Sources exist but every one is switched off: nothing could be searched. */
  hasNoActiveSource: boolean;
  /** The results were resolved against a source list that has since changed. */
  isStale: boolean;
  /** A server download would be refused: no folder for this system. */
  lacksServerFolder: boolean;
  /** lacksServerFolder, once settings have loaded — before that '' means unknown, not unset. */
  hasNoFolder: boolean;
  canResolve: boolean;
  canDownload: boolean;
}

export function resolvePanelFlags(input: ResolvePanelFlagsInput): ResolvePanelFlags {
  const hasSources = input.sourceCount > 0;
  const hasNoActiveSource = hasSources && input.activeSourceCount === 0;
  const isStale =
    input.resolvedSourceKey !== null && input.resolvedSourceKey !== input.currentSourceKey;
  const lacksServerFolder = input.downloadTarget === 'server' && input.destinationDir === '';
  return {
    hasSources,
    hasNoActiveSource,
    isStale,
    lacksServerFolder,
    hasNoFolder: lacksServerFolder && input.settingsLoaded,
    canResolve: !input.resolving && input.toResolveCount > 0 && hasSources && !hasNoActiveSource,
    canDownload: !input.queuing && !isStale && !lacksServerFolder,
  };
}

/** The games to resolve: the selection, minus owned games when asked and a scan ran. */
export function gamesToResolve(
  selectedGameIds: string[],
  missingGameIds: string[] | null,
  excludeOwned: boolean,
): string[] {
  if (excludeOwned && missingGameIds !== null) return missingGameIds;
  return selectedGameIds;
}
