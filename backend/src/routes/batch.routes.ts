import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { projectService } from '../services/project.service';
import { jobService } from '../services/job.service';
import { authMiddleware } from '../middleware/auth';
import { eq, and, inArray } from 'drizzle-orm';
import { db, schema } from '../db';

export async function batchRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.post('/batch/projects/delete', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectIds } = request.body as { projectIds: string[] };
    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return reply.code(400).send({ error: 'projectIds array is required' });
    }
    if (projectIds.length > 50) {
      return reply.code(400).send({ error: 'Maximum 50 projects per batch' });
    }

    const results: { id: string; deleted: boolean }[] = [];
    for (const id of projectIds) {
      const deleted = await projectService.delete(request.user!.userId, id);
      results.push({ id, deleted });
    }
    return reply.send({ results });
  });

  app.post('/batch/projects/process', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectIds, options } = request.body as {
      projectIds: string[];
      options?: { runOcr?: boolean; runTableDetection?: boolean; ocrLang?: string };
    };
    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return reply.code(400).send({ error: 'projectIds array is required' });
    }
    if (projectIds.length > 10) {
      return reply.code(400).send({ error: 'Maximum 10 projects per batch processing' });
    }

    const results: { id: string; jobId?: string; error?: string }[] = [];
    for (const projectId of projectIds) {
      try {
        const project = await projectService.getById(request.user!.userId, projectId);
        if (!project?.originalPdfKey) {
          results.push({ id: projectId, error: 'No PDF uploaded' });
          continue;
        }
        const job = await jobService.createProcessingJob(
          request.user!.userId,
          projectId,
          project.originalPdfKey,
          options
        );
        results.push({ id: projectId, jobId: job.id });
      } catch (err) {
        results.push({ id: projectId, error: err instanceof Error ? err.message : 'Failed' });
      }
    }
    return reply.send({ results });
  });

  app.post('/batch/projects/convert', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectIds, targetFormat } = request.body as {
      projectIds: string[];
      targetFormat: 'docx' | 'odt' | 'html';
    };
    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return reply.code(400).send({ error: 'projectIds array is required' });
    }
    if (!['docx', 'odt', 'html'].includes(targetFormat)) {
      return reply.code(400).send({ error: 'Invalid target format' });
    }

    const results: { id: string; jobId?: string; error?: string }[] = [];
    for (const projectId of projectIds) {
      try {
        const project = await projectService.getById(request.user!.userId, projectId);
        if (!project?.originalPdfKey) {
          results.push({ id: projectId, error: 'No PDF uploaded' });
          continue;
        }
        const job = await jobService.createConversionJob(
          request.user!.userId,
          projectId,
          project.originalPdfKey,
          targetFormat
        );
        results.push({ id: projectId, jobId: job.id });
      } catch (err) {
        results.push({ id: projectId, error: err instanceof Error ? err.message : 'Failed' });
      }
    }
    return reply.send({ results });
  });

  app.patch('/batch/projects/tags', async (request: FastifyRequest, reply: FastifyReply) => {
    const { updates } = request.body as {
      updates: { projectId: string; tags: string[] }[];
    };
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return reply.code(400).send({ error: 'updates array is required' });
    }

    const results: { id: string; updated: boolean }[] = [];
    for (const { projectId, tags } of updates) {
      const updated = await projectService.update(request.user!.userId, projectId, {
        tags: tags as never,
      } as never);
      results.push({ id: projectId, updated: !!updated });
    }
    return reply.send({ results });
  });
}
