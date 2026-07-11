import { z } from 'zod';

export const gameDetailsRequestSchema = z.object({
  gameIds: z.array(z.string().min(1)).min(1).max(100),
});

export type GameDetailsRequest = z.infer<typeof gameDetailsRequestSchema>;

export const gameDetailsSchema = z.object({
  gameId: z.string(),
  /** True when the provider has a boxart — fetch it from the backend proxy. */
  hasBoxart: z.boolean(),
  /** Synopsis in the configured language (fallback to the other one). */
  description: z.string().optional(),
  year: z.number().int().optional(),
  genre: z.string().optional(),
  publisher: z.string().optional(),
});

export type GameDetails = z.infer<typeof gameDetailsSchema>;

export const gameDetailsResponseSchema = z.object({
  details: z.array(gameDetailsSchema),
});

export type GameDetailsResponse = z.infer<typeof gameDetailsResponseSchema>;
