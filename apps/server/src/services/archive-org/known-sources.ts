/**
 * Multi-system collections whose identifier/title never mention a specific
 * system ("ni-roms" hosts every No-Intro set), so full-text search can't
 * surface them. They are injected as suggestion *candidates*, not trusted
 * sources: each run re-validates them (restriction flag, coverage probes),
 * so a dead or renamed identifier simply stops appearing — nothing breaks.
 *
 * Most are access-restricted and only usable with archive.org credentials.
 *
 * All of these are No-Intro (cartridge) collections — proper1g1r-collection
 * carries 173 systems and not one Sony entry. Seeding them for a Redump DAT
 * can only waste scoring slots, so suggestSources seeds them by DAT source.
 * A Redump equivalent would go in its own list.
 */
export const KNOWN_NO_INTRO_IDENTIFIERS: string[] = [
  'ni-roms', // No-Intro full sets, one ZIP per system (collection ni-romsets)
  'proper1g1r-collection', // 1G1R PropeR preset
  'hearto-1g1r-collection', // 1G1R Hearto preset
  'retro-roms-best-set',
  'no-intro_romset_collection',
];
