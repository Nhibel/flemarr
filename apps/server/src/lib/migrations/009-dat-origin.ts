// Where a DAT came from when loaded from Fresh1G1R: its preset and path in
// the repository, so the app can tell when a newer version is published.
// NULL for an imported .dat file, and for DATs loaded before this column
// existed (reloading one from Fresh1G1R records it).
export const migration009 = `
ALTER TABLE dats ADD COLUMN fresh1g1r_preset TEXT;
ALTER TABLE dats ADD COLUMN fresh1g1r_path TEXT;
`;
