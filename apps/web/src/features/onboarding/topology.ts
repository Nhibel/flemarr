import type { SettingsResponse, UpdateSettings } from '@/lib/api.js';

export type Topology = NonNullable<SettingsResponse['topology']>;

/**
 * Picking a topology writes downloadTarget with it, always, in one patch.
 * downloadTarget stays the field every code path reads (the downloader,
 * whether the scanner is offered at all, the dock's wording); topology is
 * the answer the user gave, and its being set is what tells the install
 * flow the question was asked. Keeping the two writes together is the
 * point: the alternative is two controls for one decision — which is why
 * there is no separate "destination des téléchargements" control any more.
 */
export const TOPOLOGY_PATCHES: Record<Topology, UpdateSettings> = {
  local: { topology: 'local', downloadTarget: 'server' },
  remote: { topology: 'remote', downloadTarget: 'browser' },
};

// The question is asked by where downloads land, not by where the
// collection physically lives: "this machine / a network share / a
// homelab" left a Docker install with a mounted library unsure which
// answer applied, and two of the three did the same thing anyway.
export const TOPOLOGY_OPTIONS: {
  value: Topology;
  title: string;
  hint?: string;
  body: string;
}[] = [
  {
    value: 'local',
    title: 'Dans un dossier du serveur',
    hint: 'le plus complet',
    body: 'Flemarr range et renomme les jeux dans un dossier par système, et peut scanner ce dossier pour reconnaître ce que tu as déjà. Le dossier peut être un disque local, un volume Docker ou un partage réseau monté sur le serveur.',
  },
  {
    value: 'remote',
    title: 'Dans les téléchargements de mon navigateur',
    body: "Tu ranges les jeux toi-même. Le serveur ne voit pas ta collection : le catalogue s'affiche en entier, sans savoir ce que tu possèdes.",
  },
];

/**
 * Which answer an existing install is already behaving as, for the
 * settings screen to show as selected when the question was never asked
 * (anyone who installed before the field existed). downloadTarget maps to
 * exactly one answer, so the fallback is never a guess.
 */
export function inferTopology(settings: SettingsResponse): Topology {
  if (settings.topology !== null) return settings.topology;
  return settings.downloadTarget === 'browser' ? 'remote' : 'local';
}
