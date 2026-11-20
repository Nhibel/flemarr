// Whether a resolve looks in a source. Switched per source in the UI and
// kept across sessions, so a set split across several items (one per
// letter range) can be narrowed once rather than on every visit. Existing
// and new sources are searched unless switched off.
export const migration006 = `
ALTER TABLE archive_sources ADD COLUMN searched INTEGER NOT NULL DEFAULT 1;
`;
