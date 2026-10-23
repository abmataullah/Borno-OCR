import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { projectService } from '../services/project.service';
import { getStorage } from '../services/storage.service';
import { contentDisposition } from '../utils/content-disposition';

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/public/projects/:shareToken', async (request: FastifyRequest, reply: FastifyReply) => {
    const { shareToken } = request.params as { shareToken: string };
    const project = await projectService.getByShareToken(shareToken);
    if (!project) {
      return reply.code(404).send({ error: 'Shared project not found' });
    }

    return reply.code(200).send({
      id: project.id,
      name: project.name,
      pageCount: project.pageCount,
      projectData: project.projectData,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  });

  app.get('/public/projects/:shareToken/download', async (request: FastifyRequest, reply: FastifyReply) => {
    const { shareToken } = request.params as { shareToken: string };
    const project = await projectService.getByShareToken(shareToken);
    if (!project?.originalPdfKey) {
      return reply.code(404).send({ error: 'File not found' });
    }

    const storage = getStorage();
    const buffer = await storage.download(project.originalPdfKey);
    return reply
      .code(200)
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', contentDisposition(`${project.name}.pdf`))
      .send(buffer);
  });
}
