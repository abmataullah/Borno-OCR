import { z } from 'zod';

export const createProjectSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  originalPdfKey: z.string().optional(),
  projectData: z.record(z.unknown()).optional(),
  pageCount: z.number().int().min(0).default(0),
  fileSizeKb: z.number().int().min(0).default(0),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  projectData: z.record(z.unknown()).optional(),
  pageCount: z.number().int().min(0).optional(),
  fileSizeKb: z.number().int().min(0).optional(),
  isShared: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const shareProjectSchema = z.object({
  isShared: z.boolean(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
