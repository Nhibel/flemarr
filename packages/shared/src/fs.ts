import { z } from 'zod';

export const validateDirRequestSchema = z.object({
  path: z.string().min(1),
});
export type ValidateDirRequest = z.infer<typeof validateDirRequestSchema>;

export const validateDirResponseSchema = z.object({
  exists: z.boolean(),
  isDirectory: z.boolean(),
});
export type ValidateDirResponse = z.infer<typeof validateDirResponseSchema>;
