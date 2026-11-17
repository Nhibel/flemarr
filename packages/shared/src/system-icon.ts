import { z } from 'zod';

/**
 * Which upstream icon set a system's icon came from. It is part of the
 * response because the two sets are drawn differently and so are rendered
 * differently: 'systematic' is a finished colour illustration shown as an
 * image, 'monochrome' is a white silhouette on transparent, which the web
 * app uses as a CSS mask and fills with a theme token.
 */
export const systemIconStyleSchema = z.enum(['systematic', 'monochrome']);

export type SystemIconStyle = z.infer<typeof systemIconStyleSchema>;

export const systemIconsRequestSchema = z.object({
  systems: z.array(z.string().min(1)).min(1).max(200),
});

export type SystemIconsRequest = z.infer<typeof systemIconsRequestSchema>;

export const systemIconSchema = z.object({
  system: z.string(),
  /** null = no icon exists upstream for this system; render a placeholder. */
  style: systemIconStyleSchema.nullable(),
});

export type SystemIcon = z.infer<typeof systemIconSchema>;

export const systemIconsResponseSchema = z.object({
  icons: z.array(systemIconSchema),
});

export type SystemIconsResponse = z.infer<typeof systemIconsResponseSchema>;
