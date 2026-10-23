import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { annotationService } from '../services/annotation.service';
import { authMiddleware } from '../middleware/auth';

export async function annotationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.get('/projects/:projectId/annotations', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    const pageIndex = (request.query as { page?: string })?.page;
    if (pageIndex !== undefined) {
      const annotations = await annotationService.listByPage(
        request.user!.userId,
        projectId,
        parseInt(pageIndex, 10)
      );
      return reply.send(annotations);
    }
    const annotations = await annotationService.listByProject(request.user!.userId, projectId);
    return reply.send(annotations);
  });

  app.post('/projects/:projectId/annotations', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    const body = request.body as {
      pageIndex: number;
      annotationType?: string;
      content?: string;
      bbox?: Record<string, unknown>;
      color?: string;
    };

    if (body.pageIndex === undefined || body.pageIndex === null) {
      return reply.code(400).send({ error: 'pageIndex is required' });
    }

    const annotation = await annotationService.create(
      request.user!.userId,
      projectId,
      body
    );
    return reply.code(201).send(annotation);
  });

  app.patch('/annotations/:annotationId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { annotationId } = request.params as { annotationId: string };
    const body = request.body as Partial<{
      content: string;
      bbox: Record<string, unknown>;
      color: string;
      resolved: boolean;
    }>;

    const updated = await annotationService.update(
      request.user!.userId,
      annotationId,
      body
    );
    if (!updated) {
      return reply.code(404).send({ error: 'Annotation not found' });
    }
    return reply.send(updated);
  });

  app.delete('/annotations/:annotationId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { annotationId } = request.params as { annotationId: string };
    const deleted = await annotationService.delete(request.user!.userId, annotationId);
    if (!deleted) {
      return reply.code(404).send({ error: 'Annotation not found' });
    }
    return reply.code(204).send();
  });
}
