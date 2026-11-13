import { css } from '@/styled-system/css';

interface Term {
  term: string;
  definition: string;
}

interface Section {
  title: string;
  terms: Term[];
}

// Static reference content — jargon that comes up across the Fresh1G1R
// loader, the game list and the archive.org sources tab, gathered as
// questions came up rather than written up front.
const SECTIONS: Section[] = [
  {
    title: 'Sets et presets',
    terms: [
      {
        term: '1G1R (One Game One ROM)',
        definition:
          'Une sélection qui ne garde qu’une seule version par jeu (langue/région préférée, dernière révision, licencié) au lieu de toutes les variantes régionales.',
      },
      {
        term: 'No-Intro',
        definition:
          'L’autorité de référence pour les systèmes à cartouche (NES, SNES, N64, GBA, DS…).',
      },
      {
        term: 'Redump',
        definition:
          'L’autorité de référence pour les systèmes à disque (PS1, PS2, GameCube, Dreamcast…).',
      },
      {
        term: 'McLean',
        definition: 'Preset 1G1R le plus strict — anglais uniquement, jeux licenciés seulement.',
      },
      {
        term: 'PropeR',
        definition:
          'Preset 1G1R intermédiaire — toutes langues, jeux + add-ons/bonus discs/éducatif, officiel uniquement.',
      },
      {
        term: 'Hearto',
        definition:
          'Preset 1G1R le plus large — toutes langues, démos, non-licenciés, proto/bêta/alpha inclus.',
      },
      {
        term: 'DAT',
        definition:
          'Fichier XML qui liste tous les jeux officiels d’un système avec leurs empreintes (CRC32, MD5, SHA1) — rom-curator s’en sert pour savoir quoi chercher et vérifier.',
      },
      {
        term: 'Retool',
        definition:
          'L’outil qui produit les DAT 1G1R de Fresh1G1R à partir des DAT bruts No-Intro/Redump : il repère lui-même les jeux apparentés (il n’utilise pas les infos parent/clone déjà présentes dans le DAT) et n’en garde qu’un par groupe, selon le preset choisi.',
      },
    ],
  },
  {
    title: 'Régions et catégories',
    terms: [
      {
        term: 'Région (USA / Europe / Japan / World)',
        definition: 'La zone de la release retenue par le 1G1R pour ce jeu.',
      },
      {
        term: '(Rev X)',
        definition:
          'Révision — une réédition corrigée de la même release, sortie après la première version.',
      },
      { term: 'Game', definition: 'Jeu officiel, sans particularité.' },
      { term: 'Demo', definition: 'Version de démonstration, pas le jeu complet.' },
      {
        term: 'Proto',
        definition: 'Prototype — une version de développement, jamais sortie telle quelle.',
      },
      { term: 'Beta', definition: 'Version bêta — antérieure à la version finale.' },
      { term: 'Unl (Unlicensed)', definition: 'Jeu non-licencié par le fabricant de la console.' },
      {
        term: 'Aftermarket',
        definition: 'Réédition tardive, non-officielle, produite après l’arrêt de la console.',
      },
    ],
  },
  {
    title: 'Formats de ROM',
    terms: [
      {
        term: 'Headered / Headerless',
        definition:
          'Certains systèmes (NES surtout) ajoutent un petit en-tête technique (16 octets pour le format iNES) devant les données brutes de la cartouche. No-Intro référence ses jeux sans cet en-tête ("Headerless"), mais plusieurs émulateurs en ont besoin pour charger le jeu correctement — d’où un DAT "Headered" séparé, avec l’en-tête ajouté.',
      },
      {
        term: 'BigEndian (.z64)',
        definition:
          'Ordre d’octets natif de la N64 — le format standard, accepté directement par la plupart des émulateurs modernes.',
      },
      {
        term: 'ByteSwapped (.v64)',
        definition:
          'Octets inversés par paires — hérité de vieux copieurs de cartouche. À choisir seulement si ton émulateur l’exige.',
      },
      {
        term: '64DD',
        definition:
          'Lecteur de disque magnétique additionnel pour la N64 (Japon uniquement) — une bibliothèque de jeux séparée, pas un format d’encodage.',
      },
      {
        term: 'CRC32',
        definition:
          'Empreinte rapide calculée sur chaque ROM pour vérifier qu’un fichier correspond bien à l’entrée du DAT.',
      },
      {
        term: 'DS/DSi — Decrypted / Encrypted / Download Play / DSvision / Digital',
        definition:
          'No-Intro scinde la DS/DSi en plusieurs sets distincts. "Decrypted" = cartouches normales, jouables directement — c’est celui qu’il faut dans la grande majorité des cas. "Encrypted" = mêmes jeux avec la zone sécurisée restée chiffrée (préservation/flashcart, pas pour émuler). "Download Play" = démos multijoueur diffusées par un cartouche hôte, pas les jeux complets. "DSvision SD cards" = matériel éducatif tiers, sans rapport avec les jeux DS classiques. "DSi (Digital)" / "(Digital) (CDN) (Decrypted/Encrypted)" = titres DSiWare (boutique numérique), les variantes CDN ne changeant que la source du dump — "Decrypted" reste le bon choix.',
      },
    ],
  },
  {
    title: 'Archive.org et téléchargement',
    terms: [
      {
        term: 'Identifiant (de collection)',
        definition:
          'La fin de l’URL archive.org/details/<identifiant> — l’adresse unique d’un item sur archive.org.',
      },
      {
        term: 'Layout direct / zip-collection / auto',
        definition:
          'Comment les ROMs sont stockées dans la collection : fichiers séparés, ou un seul ZIP contenant tout. En mode "auto", rom-curator le détecte lui-même.',
      },
      {
        term: 'Collection en série (partN / discN / cdN / diskN)',
        definition:
          'Certains gros sets sont scindés en plusieurs items archive.org faute de limite de taille — un usage courant, pas une convention fixe garantie.',
      },
      {
        term: 'Collection access-restricted',
        definition:
          'Collection qui exige un compte archive.org (identifiants dans Réglages) pour être téléchargée.',
      },
      {
        term: 'BIN/CUE vs CHD',
        definition:
          'Deux façons de stocker une image de disque (PS1, PS2, GameCube…). BIN/CUE est le format brut, "tel que vérifié par Redump". CHD compresse la même image sans perte (fichier plus petit, un seul fichier au lieu d’un .cue + plusieurs .bin), mais certains émulateurs ne le lisent pas directement.',
      },
    ],
  },
];

export function LexiquePage({ onClose }: { onClose: () => void }) {
  return (
    <main
      className={css({
        maxW: '6xl',
        mx: 'auto',
        mt: { base: '8', md: '16' },
        px: { base: '4', md: '6', lg: '8' },
        pb: '12',
      })}
    >
      <div className={css({ display: 'flex', alignItems: 'center', gap: '4', mb: '8' })}>
        <h1 className={css({ fontSize: '3xl', fontWeight: 'bold', color: 'fg.heading', flex: 1 })}>
          Lexique
        </h1>
        <button
          onClick={onClose}
          className={css({
            fontSize: 'sm',
            color: 'accent.text',
            cursor: 'pointer',
            _hover: { textDecoration: 'underline' },
          })}
        >
          ← Retour
        </button>
      </div>

      {SECTIONS.map((section) => (
        <section
          key={section.title}
          className={css({
            pb: '6',
            mb: '6',
            borderBottom: '1px solid',
            borderColor: 'bd.subtle',
            _last: { borderBottom: 'none', mb: '0', pb: '0' },
          })}
        >
          <h2
            className={css({
              fontSize: 'base',
              fontWeight: 'semibold',
              color: 'fg.default',
              mb: '3',
            })}
          >
            {section.title}
          </h2>
          <dl className={css({ display: 'flex', flexDirection: 'column', gap: '3' })}>
            {section.terms.map((t) => (
              <div key={t.term}>
                <dt
                  className={css({ fontSize: 'sm', fontWeight: 'semibold', color: 'fg.heading' })}
                >
                  {t.term}
                </dt>
                <dd className={css({ fontSize: 'sm', color: 'fg.muted' })}>{t.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </main>
  );
}
