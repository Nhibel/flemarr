import type { SettingsResponse, UpdateSettings } from '@/lib/api.js';

export type Topology = NonNullable<SettingsResponse['topology']>;

/**
 * Picking a topology writes downloadTarget with it, always, in one patch.
 * downloadTarget stays the field every code path reads (the downloader,
 * whether the scanner is offered at all, the dock's wording); this is the
 * question the user actually answers. Keeping the two writes together is
 * the point: the alternative is two controls for one decision, which is
 * what the design canvas warned against — and it is why there is no
 * separate "destination des téléchargements" control any more.
 *
 * `local` and `mounted` produce identical settings. They are separate
 * answers anyway, because "is the collection on this machine or on a
 * network share?" is answerable without knowing how the app works, and
 * "should downloads go to the server?" is not.
 */
export const TOPOLOGY_PATCHES: Record<Topology, UpdateSettings> = {
  local: { topology: 'local', downloadTarget: 'server' },
  mounted: { topology: 'mounted', downloadTarget: 'server' },
  remote: { topology: 'remote', downloadTarget: 'browser' },
};

export const TOPOLOGY_OPTIONS: {
  value: Topology;
  title: string;
  hint?: string;
  body: string;
}[] = [
  {
    value: 'local',
    title: 'Sur cette machine',
    hint: 'le plus simple',
    body: "Flemarr tourne là où ta collection est stockée. Les jeux téléchargés sont rangés et renommés tout seuls, et l'app reconnaît ce que tu as déjà.",
  },
  {
    value: 'mounted',
    title: 'Ailleurs, mais sur un disque réseau monté sur ce serveur',
    body: 'Le serveur voit ta collection par le réseau. Comme le premier cas : un dossier te sera demandé, et il servira à la fois à reconnaître ce que tu as et à y ranger les téléchargements.',
  },
  {
    value: 'remote',
    title: 'Ailleurs — Flemarr tourne sur un serveur, un NAS, un homelab',
    body: "Les jeux arrivent dans les téléchargements de ton navigateur, tu les ranges ensuite. Aucun dossier ne te sera demandé : le serveur ne peut pas voir ton disque, donc l'app affichera le catalogue complet sans savoir ce que tu possèdes.",
  },
];

/**
 * Which topology an existing install is already behaving as, for the
 * settings screen to show as selected when the question was never asked
 * (anyone who installed before the field existed). Deliberately collapses
 * to the only thing that is actually knowable from downloadTarget — a
 * server target could be `local` or `mounted`, and guessing between them
 * would put a wrong answer on screen, so it reports `local`, the common
 * case, rather than nothing.
 */
export function inferTopology(settings: SettingsResponse): Topology {
  if (settings.topology !== null) return settings.topology;
  return settings.downloadTarget === 'browser' ? 'remote' : 'local';
}
