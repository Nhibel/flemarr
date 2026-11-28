import { z } from 'zod';

export const fileCrcSchema = z.string().regex(/^[0-9a-f]{8}$/);

/**
 * A file the DAT does not list, attached by the user to one of its games:
 * another version of it (region, language, revision).
 */
const gameLinkSchema = z.object({
  fileCrc: fileCrcSchema,
  // Null when the DAT no longer has the game.
  gameId: z.string().nullable(),
  gameName: z.string(),
});
export type GameLink = z.infer<typeof gameLinkSchema>;

export const gameLinksResponseSchema = z.object({ links: z.array(gameLinkSchema) });
export type GameLinksResponse = z.infer<typeof gameLinksResponseSchema>;

export const saveGameLinkRequestSchema = z.object({ gameId: z.string().min(1) });

// Several files attached in one go: all are saved, or none.
export const saveGameLinksRequestSchema = z.object({
  links: z
    .array(z.object({ fileCrc: fileCrcSchema, gameId: z.string().min(1) }))
    .min(1)
    .max(10_000),
});
export type SaveGameLinksRequest = z.infer<typeof saveGameLinksRequestSchema>;
