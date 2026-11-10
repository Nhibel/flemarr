// An archive.org identifier can legitimately serve several systems: the
// multi-system collections in known-sources.ts ("ni-roms" hosts every
// No-Intro set, proper1g1r-collection every PropeR 1G1R set) are the normal
// case, and the resolver looks sources up per system (getSources(dat.system)).
//
// The original `identifier TEXT PRIMARY KEY` made that impossible: the second
// system's INSERT OR IGNORE was silently dropped, so adopting ni-roms for NES
// after SNES did nothing at all. The key is the (identifier, system) pair.
//
// SQLite can't alter a primary key in place — rebuild and copy. Existing rows
// are already unique on identifier alone, so nothing is lost.
export const migration005 = `
CREATE TABLE archive_sources_new (
  identifier TEXT NOT NULL,
  system TEXT NOT NULL,
  layout TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (identifier, system)
);

INSERT INTO archive_sources_new (identifier, system, layout, note)
  SELECT identifier, system, layout, note FROM archive_sources;

DROP TABLE archive_sources;

ALTER TABLE archive_sources_new RENAME TO archive_sources;

CREATE INDEX IF NOT EXISTS idx_archive_sources_system ON archive_sources(system);
`;
