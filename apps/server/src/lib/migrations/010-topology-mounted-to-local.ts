// The install question used to offer `mounted` (a network share mounted on
// the server) beside `local`. Both always meant the same thing to the code —
// downloads to a server folder — so the two answers were merged into
// `local`. An install that recorded `mounted` would otherwise fail the
// settings response schema, which no longer accepts it.
export const migration010 = `
UPDATE settings SET value = 'local' WHERE key = 'topology' AND value = 'mounted';
`;
