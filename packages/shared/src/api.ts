import { z } from 'zod';
import { datSummarySchema, gameSchema } from './dat.js';

export const datUploadResponseSchema = datSummarySchema;
export type DatUploadResponse = z.infer<typeof datUploadResponseSchema>;

export const gamesResponseSchema = z.object({
  games: z.array(gameSchema),
});
export type GamesResponse = z.infer<typeof gamesResponseSchema>;

export const listDatsResponseSchema = z.object({
  dats: z.array(datSummarySchema),
});
export type ListDatsResponse = z.infer<typeof listDatsResponseSchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
