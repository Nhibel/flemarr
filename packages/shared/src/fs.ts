import { z } from 'zod';

export const validateDirRequestSchema = z.object({
  path: z.string().min(1),
});
export const listDirsResponseSchema = z.object({
  listedPath: z.string(),
  parent: z.string().nullable(),
  dirs: z.array(z.string()),
});
export type ListDirsResponse = z.infer<typeof listDirsResponseSchema>;
